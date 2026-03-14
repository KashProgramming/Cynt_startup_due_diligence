"""
Integration test for the investment decision & collaboration workflow.

Tests the complete flow:
  1. Accept/reject decisions with edge-case guards
  2. Collaboration invites with all 5 rule validations
  3. Collaboration decisions (accept/reject) with finality guards
  4. Deal summary correctness

Usage:
    python test_investment_workflow.py

Requires the server to be running (python main.py) or use with TestClient.
"""
import json
import requests

BASE = "http://localhost:8000"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def post_form(url, data):
    """POST with form-encoded JSON payload."""
    return requests.post(url, data={"payload": json.dumps(data)})


def register_user(name, email, role, **kwargs):
    data = {"name": name, "email": email, "password": "test123", "role": role, **kwargs}
    r = post_form(f"{BASE}/auth/register", data)
    if r.status_code == 409:
        # Already exists, just login
        r = post_form(f"{BASE}/auth/login", {"email": email, "password": "test123"})
    return r.json()


def submit_app(entrepreneur, investor, company_name="TestCo"):
    """Submit a minimal application (no real files, just bytes)."""
    files = {
        "pitch_deck": ("deck.pdf", b"%PDF-fake", "application/pdf"),
        "financials": ("fin.csv", b"Metric,Current\nRevenue,1000", "text/csv"),
        "founder_profile": ("founder.pdf", b"%PDF-fake", "application/pdf"),
    }
    data = {
        "investor_id": investor["_id"],
        "entrepreneur_id": entrepreneur["_id"],
        "entrepreneur_name": entrepreneur["name"],
        "company_name": company_name,
        "linkedin_url": "https://linkedin.com/in/test",
    }
    r = requests.post(f"{BASE}/applications", files=files, data=data)
    return r.json()


# ─── Test Scenarios ───────────────────────────────────────────────────────────

def test_basic_accept_reject():
    """Test: Accept and reject decisions with finality guard."""
    print("\n═══ Test 1: Basic Accept/Reject with Finality ═══")
    
    ent = register_user("Ent1", "ent_test1@test.com", "entrepreneur")
    inv_a = register_user("Investor A", "inv_a_test@test.com", "investor",
                          investor_type="EARLY_VC", sectors=["ai"], stages=["seed"],
                          geographies=["India"], check_size_range_usd=[100000, 500000])
    inv_b = register_user("Investor B", "inv_b_test@test.com", "investor",
                          investor_type="ANGEL", sectors=["saas"], stages=["seed"],
                          geographies=["US"], check_size_range_usd=[50000, 200000])

    # Submit apps to both investors
    app_a = submit_app(ent, inv_a, "TestStartup1")
    app_b = submit_app(ent, inv_b, "TestStartup1")

    # Accept investor A
    r = post_form(f"{BASE}/applications/{app_a['_id']}/decision",
                  {"decision": "accepted", "message": "Great startup!"})
    assert r.status_code == 200, f"Accept failed: {r.text}"
    assert r.json()["status"] == "ACCEPTED"
    print("  ✅ Investor A accepted")

    # Reject investor B
    r = post_form(f"{BASE}/applications/{app_b['_id']}/decision",
                  {"decision": "rejected", "message": "Not a fit"})
    assert r.status_code == 200, f"Reject failed: {r.text}"
    assert r.json()["status"] == "REJECTED"
    print("  ✅ Investor B rejected")

    # Try to change decision — should fail
    r = post_form(f"{BASE}/applications/{app_a['_id']}/decision",
                  {"decision": "rejected"})
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    print("  ✅ Cannot change accepted decision (409)")

    r = post_form(f"{BASE}/applications/{app_b['_id']}/decision",
                  {"decision": "accepted"})
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    print("  ✅ Cannot change rejected decision (409)")

    return ent, inv_a, inv_b, app_a, app_b


def test_collaboration_invites(ent, inv_a, inv_b, app_a, app_b):
    """Test: Collaboration invite guards."""
    print("\n═══ Test 2: Collaboration Invite Guards ═══")
    
    inv_d = register_user("Investor D", "inv_d_test@test.com", "investor",
                          investor_type="EARLY_VC", sectors=["ai"], stages=["seed"],
                          geographies=["India"], check_size_range_usd=[100000, 500000])
    inv_e = register_user("Investor E", "inv_e_test@test.com", "investor",
                          investor_type="ANGEL", sectors=["fintech"], stages=["seed"],
                          geographies=["US"], check_size_range_usd=[50000, 200000])

    # Guard 1: Rejected investor trying to invite — should fail
    r = post_form(f"{BASE}/collaborations/invite", {
        "application_id": app_b["_id"],
        "inviting_investor_id": inv_b["_id"],
        "collaborator_investor_id": inv_d["_id"],
    })
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    print("  ✅ Rejected investor cannot invite (403)")

    # Guard 2: Cannot invite a rejected investor
    r = post_form(f"{BASE}/collaborations/invite", {
        "application_id": app_a["_id"],
        "inviting_investor_id": inv_a["_id"],
        "collaborator_investor_id": inv_b["_id"],
    })
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    print("  ✅ Cannot invite rejected investor (409)")

    # Guard 4: Cannot invite yourself
    r = post_form(f"{BASE}/collaborations/invite", {
        "application_id": app_a["_id"],
        "inviting_investor_id": inv_a["_id"],
        "collaborator_investor_id": inv_a["_id"],
    })
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"
    print("  ✅ Cannot invite yourself (422)")

    # Happy path: Accepted investor invites D and E
    r = post_form(f"{BASE}/collaborations/invite", {
        "application_id": app_a["_id"],
        "inviting_investor_id": inv_a["_id"],
        "collaborator_investor_id": inv_d["_id"],
    })
    assert r.status_code == 200, f"Invite D failed: {r.text}"
    invite_d = r.json()
    print(f"  ✅ Investor D invited (ID: {invite_d['_id']})")

    r = post_form(f"{BASE}/collaborations/invite", {
        "application_id": app_a["_id"],
        "inviting_investor_id": inv_a["_id"],
        "collaborator_investor_id": inv_e["_id"],
    })
    assert r.status_code == 200, f"Invite E failed: {r.text}"
    invite_e = r.json()
    print(f"  ✅ Investor E invited (ID: {invite_e['_id']})")

    # Guard 3: Duplicate invite — should fail
    r = post_form(f"{BASE}/collaborations/invite", {
        "application_id": app_a["_id"],
        "inviting_investor_id": inv_a["_id"],
        "collaborator_investor_id": inv_d["_id"],
    })
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    print("  ✅ Duplicate invite blocked (409)")

    return invite_d, invite_e


def test_collaboration_decisions(invite_d, invite_e):
    """Test: Collaboration accept/reject with finality."""
    print("\n═══ Test 3: Collaboration Decisions ═══")

    # D accepts
    r = post_form(f"{BASE}/collaborations/invites/{invite_d['_id']}/decide",
                  {"decision": "accept"})
    assert r.status_code == 200, f"D accept failed: {r.text}"
    assert r.json()["status"] == "COLLAB_ACCEPTED"
    print("  ✅ Investor D accepted collaboration")

    # E rejects
    r = post_form(f"{BASE}/collaborations/invites/{invite_e['_id']}/decide",
                  {"decision": "reject"})
    assert r.status_code == 200, f"E reject failed: {r.text}"
    assert r.json()["status"] == "COLLAB_REJECTED"
    print("  ✅ Investor E rejected collaboration")

    # E tries to change mind — should fail
    r = post_form(f"{BASE}/collaborations/invites/{invite_e['_id']}/decide",
                  {"decision": "accept"})
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    print("  ✅ Cannot reverse rejected collaboration (409)")

    # D tries to change mind — should also fail
    r = post_form(f"{BASE}/collaborations/invites/{invite_d['_id']}/decide",
                  {"decision": "reject"})
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    print("  ✅ Cannot reverse accepted collaboration (409)")


def test_deal_summary(app_a):
    """Test: Deal summary shows correct data."""
    print("\n═══ Test 4: Deal Summary ═══")

    r = requests.get(f"{BASE}/applications/{app_a['_id']}/deal-summary")
    assert r.status_code == 200, f"Deal summary failed: {r.text}"
    
    summary = r.json()
    print(f"  Company: {summary['company_name']}")
    
    print("  Investors:")
    for inv in summary["investors"]:
        print(f"    {inv['investor_name']} -> {inv['status']}")
    
    print("  Collaborators:")
    for col in summary["collaborators"]:
        print(f"    {col['collaborator_investor_name']} -> {col['status']} (invited by {col['invited_by_investor_name']})")
    
    print("  Active Investors:")
    for active in summary["active_investors"]:
        role = active.get("role", "")
        invited_by = f" (invited by {active['invited_by']})" if "invited_by" in active else ""
        print(f"    {active['investor_name']} [{role}]{invited_by}")

    # Verify structure
    assert len(summary["investors"]) >= 2, "Should have at least 2 investors"
    assert len(summary["active_investors"]) >= 1, "Should have at least 1 active investor"
    print("  ✅ Deal summary structure verified")


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🚀 Running Investment Workflow Integration Tests")
    print(f"   Server: {BASE}")
    
    try:
        requests.get(f"{BASE}/health", timeout=3)
    except Exception:
        print("❌ Server not reachable. Start with: python main.py")
        exit(1)

    try:
        ent, inv_a, inv_b, app_a, app_b = test_basic_accept_reject()
        invite_d, invite_e = test_collaboration_invites(ent, inv_a, inv_b, app_a, app_b)
        test_collaboration_decisions(invite_d, invite_e)
        test_deal_summary(app_a)
        print("\n✅ ALL TESTS PASSED!")
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        exit(1)
"""
Note: run these tests with the server running. They create test users so 
they should be run against a dev/test database, not production.
"""

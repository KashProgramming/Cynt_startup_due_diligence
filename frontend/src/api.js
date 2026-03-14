const _isLocalDev = window.location.port >= "5170" && window.location.port <= "5180";
const API_BASE_URL = _isLocalDev ? "http://localhost:8000" : window.location.origin;

async function _json(res) {
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

export const api = {
    health: async () => {
        const res = await fetch(`${API_BASE_URL}/health`);
        return _json(res);
    },

    // ─── Auth ────────────────────────────────────────────────────────────
    register: async (data) => {
        const fd = new FormData();
        fd.append("payload", JSON.stringify(data));
        const res = await fetch(`${API_BASE_URL}/auth/register`, { method: "POST", body: fd });
        return _json(res);
    },

    login: async (email, password) => {
        const fd = new FormData();
        fd.append("payload", JSON.stringify({ email, password }));
        const res = await fetch(`${API_BASE_URL}/auth/login`, { method: "POST", body: fd });
        return _json(res);
    },

    // ─── Investors ───────────────────────────────────────────────────────
    getInvestors: async () => {
        const res = await fetch(`${API_BASE_URL}/investors`);
        return _json(res);
    },

    // ─── Applications ────────────────────────────────────────────────────
    submitApplication: async (entrepreneurId, entrepreneurName, investorId, companyName, linkedinUrl, pitchDeck, financials, founderProfile) => {
        const fd = new FormData();
        fd.append("entrepreneur_id", entrepreneurId);
        fd.append("entrepreneur_name", entrepreneurName);
        fd.append("investor_id", investorId);
        fd.append("company_name", companyName);
        fd.append("linkedin_url", linkedinUrl);
        fd.append("pitch_deck", pitchDeck);
        fd.append("financials", financials);
        fd.append("founder_profile", founderProfile);
        const res = await fetch(`${API_BASE_URL}/applications`, { method: "POST", body: fd });
        return _json(res);
    },

    getInvestorApplications: async (investorId) => {
        const res = await fetch(`${API_BASE_URL}/applications/investor/${investorId}`);
        return _json(res);
    },

    getEntrepreneurApplications: async (entrepreneurId) => {
        const res = await fetch(`${API_BASE_URL}/applications/entrepreneur/${entrepreneurId}`);
        return _json(res);
    },

    analyzeApplication: async (appId) => {
        const res = await fetch(`${API_BASE_URL}/applications/${appId}/analyze`, { method: "POST" });
        return _json(res);
    },

    setDecision: async (appId, decision, message) => {
        const fd = new FormData();
        fd.append("payload", JSON.stringify({ decision, message }));
        const res = await fetch(`${API_BASE_URL}/applications/${appId}/decision`, { method: "POST", body: fd });
        return _json(res);
    },

    // ─── Collaborations ──────────────────────────────────────────────────
    createCollaboration: async (applicationId, leadInvestorId, leadInvestorName) => {
        const fd = new FormData();
        fd.append("payload", JSON.stringify({
            application_id: applicationId,
            lead_investor_id: leadInvestorId,
            lead_investor_name: leadInvestorName,
        }));
        const res = await fetch(`${API_BASE_URL}/collaborations`, { method: "POST", body: fd });
        return _json(res);
    },

    getCollaborationForApp: async (appId) => {
        const res = await fetch(`${API_BASE_URL}/collaborations/application/${appId}`);
        if (res.status === 200) {
            const data = await res.json();
            return data; // may be null
        }
        return null;
    },

    inviteCollaborator: async (collabId, investorId, investorName) => {
        const fd = new FormData();
        fd.append("payload", JSON.stringify({ investor_id: investorId, investor_name: investorName }));
        const res = await fetch(`${API_BASE_URL}/collaborations/${collabId}/invite`, { method: "POST", body: fd });
        return _json(res);
    },

    assessAsCollaborator: async (collabId, investorId) => {
        const res = await fetch(`${API_BASE_URL}/collaborations/${collabId}/assess/${investorId}`, { method: "POST" });
        return _json(res);
    },

    getMyCollaborations: async (investorId) => {
        const res = await fetch(`${API_BASE_URL}/collaborations/investor/${investorId}`);
        return _json(res);
    },

    // ─── Collaboration Invites (new workflow) ────────────────────────────
    inviteCollaboratorNew: async (applicationId, invitingInvestorId, collaboratorInvestorId) => {
        const fd = new FormData();
        fd.append("payload", JSON.stringify({
            application_id: applicationId,
            inviting_investor_id: invitingInvestorId,
            collaborator_investor_id: collaboratorInvestorId,
        }));
        const res = await fetch(`${API_BASE_URL}/collaborations/invite`, { method: "POST", body: fd });
        return _json(res);
    },

    decideCollaborationInvite: async (inviteId, decision) => {
        const fd = new FormData();
        fd.append("payload", JSON.stringify({ decision }));
        const res = await fetch(`${API_BASE_URL}/collaborations/invites/${inviteId}/decide`, { method: "POST", body: fd });
        return _json(res);
    },

    assessCollabInvite: async (inviteId) => {
        const res = await fetch(`${API_BASE_URL}/collaborations/invites/${inviteId}/assess`, { method: "POST" });
        return _json(res);
    },

    getInvitesForInvestor: async (investorId) => {
        const res = await fetch(`${API_BASE_URL}/collaborations/invites/investor/${investorId}`);
        return _json(res);
    },

    getSentInvites: async (investorId) => {
        const res = await fetch(`${API_BASE_URL}/collaborations/invites/sent/${investorId}`);
        return _json(res);
    },

    getDealSummary: async (appId) => {
        const res = await fetch(`${API_BASE_URL}/applications/${appId}/deal-summary`);
        return _json(res);
    },

    getCollaborationHub: async (investorId) => {
        const res = await fetch(`${API_BASE_URL}/collaborations/hub/${investorId}`);
        return _json(res);
    },

    // ─── Legacy ──────────────────────────────────────────────────────────
    extractProfile: async (pitchDeck, financials, founderProfile) => {
        const fd = new FormData();
        fd.append("pitch_deck", pitchDeck);
        fd.append("financials", financials);
        fd.append("founder_profile", founderProfile);
        const res = await fetch(`${API_BASE_URL}/extract-profile`, { method: "POST", body: fd });
        return _json(res);
    },

    analyze: async (pitchDeck, financials, founderProfile, portfolioConfig) => {
        const fd = new FormData();
        fd.append("pitch_deck", pitchDeck);
        fd.append("financials", financials);
        fd.append("founder_profile", founderProfile);
        fd.append("portfolio", JSON.stringify(portfolioConfig));
        const res = await fetch(`${API_BASE_URL}/analyze`, { method: "POST", body: fd });
        return _json(res);
    },
};

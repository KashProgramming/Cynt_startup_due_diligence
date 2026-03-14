---
title: Cynt
emoji: 📊
colorFrom: red
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Cynt — AI-Powered Investment Intelligence

An end-to-end AI-powered startup due diligence engine for investors and entrepreneurs.

## Features

- **Entrepreneur Portal**: Upload pitch decks, financial sheets, and founder profiles. Apply to multiple investors simultaneously.
- **Investor Portal**: Review applications, run AI-powered analysis, approve/decline with email notifications.
- **AI Analysis Pipeline**: Financial simulation, market validation, founder intelligence, and investment decision engine powered by LLaMA 3.3 70B via Groq.
- **Collaboration Hub**: Investors can collaborate on deals and share analysis.
- **Interactive Results**: Radar charts, bar charts, donut charts, and expandable metric explanations.

## Environment Variables (set as HF Space Secrets)

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key for LLM |
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `NEWS_API_KEY` | ⬡ | NewsAPI.org key |
| `RAPIDAPI_KEY` | ⬡ | RapidAPI key for LinkedIn scraping |
| `RAPIDAPI_HOST` | ⬡ | `fresh-linkedin-scraper-api.p.rapidapi.com` |
| `SMTP_EMAIL` | ⬡ | Gmail for notifications |
| `SMTP_PASSWORD` | ⬡ | Gmail app password |
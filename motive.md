# PROJECT MASTER PROMPT — AI Executive Assistant Automation Agent

You are helping build a production-grade AI automation assistant that acts like a personal executive agent. This product should intelligently read, organize, summarize, and help the user take action across communication channels.

The system must be modular, scalable, secure, and production ready.

---

# PRIMARY PRODUCT VISION

Build an AI agent that connects to:

1. WhatsApp (using Baileys by WhiskeySockets)
2. Gmail / Email
3. Notion
4. Future integrations (Calendar, Drive, Slack, Telegram, etc.)

The AI assistant should help users:

* Summarize unread messages
* Detect urgent conversations
* Find things user missed
* Extract tasks automatically
* Create to-do lists
* Detect deadlines
* Suggest replies
* Search old chats/emails
* Build daily digest reports
* Maintain memory/context of important people and events
* Work like a personal chief of staff

---

# REQUIRED CORE INTEGRATIONS

## 1. WhatsApp Integration

Use:
Baileys (WhiskeySockets)

Responsibilities:

* QR login
* Session persistence
* Read incoming messages
* Detect sender
* Read groups and DMs
* Send messages later
* Download media later if needed

Events to listen:

* messages.upsert
* connection.update
* creds.update

---

## 2. Email Integration

Start with Gmail API.

Responsibilities:

* OAuth login
* Read inbox
* Read unread emails
* Detect sender, subject, body
* Mark processed emails
* Watch for new emails

Later support Outlook.

---

## 3. Notion Integration

Use Notion API.

Use Notion as:

### Tasks Database

Properties:

* Title
* Priority
* Due Date
* Source
* Status
* Created Time

### Memory Database

Properties:

* Person Name
* Relationship
* Notes
* Last Interaction
* Importance

### Daily Digest Database

Properties:

* Date
* Summary
* Missed Tasks
* Important Conversations

---

# DATABASE STACK (MANDATORY)

Use Firebase.

Preferred setup:

## Firebase Services

### Firestore

Collections:

users
messages
emails
tasks
summaries
contacts
sessions
settings

### Firebase Auth

Use Google login.

### Firebase Storage

For media files later.

### Firebase Cloud Functions (optional later)

For triggers / scheduled jobs.

---

# TECH STACK

## Backend

Use TypeScript + Node.js

Recommended:

* Fastify or Express
* TypeScript
* Zod validation
* Firebase Admin SDK

## Frontend

Use Next.js + TypeScript + Tailwind CSS

Dashboard should look modern, premium, clean, dark mode friendly.

## AI Layer

Use OpenRouter API or OpenAI compatible provider.

Models should be replaceable.

---

# CORE USER FLOWS

## FLOW 1 — WhatsApp Message Processing

When a new WhatsApp message arrives:

1. Save message in Firestore
2. Send text to AI analyzer
3. AI extracts:

* summary
* urgency
* sentiment
* action items
* reminder dates
* people involved

4. If task detected:

Create task in Firebase + Notion

5. Update dashboard

---

## FLOW 2 — Email Processing

When new email arrives:

1. Read subject/body
2. Save to Firestore
3. AI classifies:

* important?
* promotional?
* urgent?
* deadline?
* task?

4. Create task if needed
5. Show in digest

---

## FLOW 3 — Daily Digest

Every night generate:

Today Summary:

* Important WhatsApp chats
* Important emails
* Tasks pending
* Missed replies
* Deadlines tomorrow
* Suggested priorities

Store in Firebase and optionally Notion.

---

## FLOW 4 — Ask AI Search

User can ask:

* What did I miss today?
* Summarize Rahul messages.
* Any urgent unread emails?
* What tasks are pending?
* Who should I reply to?
* Show internship related conversations.

Search across all stored sources.

---

# FIRESTORE DATA DESIGN

## users/{uid}

* name
* email
* createdAt
* plan
* settings

## users/{uid}/messages/{id}

* source: whatsapp
* sender
* text
* timestamp
* summary
* urgency
* processed

## users/{uid}/emails/{id}

* from
* subject
* body
* labels
* timestamp
* processed

## users/{uid}/tasks/{id}

* title
* dueDate
* priority
* source
* completed

## users/{uid}/memory/{id}

* person
* notes
* tags
* lastSeen

## users/{uid}/digests/{id}

* date
* content

---

# FRONTEND DASHBOARD PAGES

## 1. Overview

* unread count
* urgent items
* today tasks
* recent activity

## 2. Messages

Unified inbox (WhatsApp + Email)

## 3. Tasks

Kanban or list view

## 4. AI Assistant

Chat with your data

## 5. Memory

Important people and context

## 6. Settings

Connect accounts

---

# UI STYLE REQUIREMENTS

* Sleek modern SaaS design
* Dark mode default
* Glassmorphism optional
* Minimal clutter
* Smooth animations
* Mobile responsive
* Premium startup quality

---

# AI BEHAVIOR RULES

The AI should behave like an executive assistant:

* concise
* smart
* proactive
* useful
* non-spammy
* privacy respecting
* high signal only

Never overwhelm user.

Prioritize what matters.

---

# SECURITY REQUIREMENTS

* Encrypt tokens
* Secure Firebase rules
* User-owned data only
* Clear delete data option
* Safe session handling
* No data leakage between users

---

# MVP PRIORITY ORDER

## PHASE 1

* Firebase auth
* WhatsApp login via Baileys
* Gmail connect
* Firestore storage
* Dashboard UI

## PHASE 2

* AI summaries
* Todo extraction
* Daily digest
* Search

## PHASE 3

* Auto reply drafts
* Calendar sync
* Voice assistant
* Full autonomous workflows

---

# CODING RULES

* Use clean architecture
* Reusable modules
* Strong typing
* Environment variables
* Proper folder structure
* Scalable services
* Avoid spaghetti code

---

# WHAT TO GENERATE FIRST

Generate complete production project structure first.

Then build in this order:

1. Monorepo structure
2. Firebase config
3. Next.js frontend
4. Node backend
5. Baileys WhatsApp service
6. Gmail integration
7. Notion integration
8. AI pipelines
9. Dashboard pages

---

# IMPORTANT NOTE

This is not a toy chatbot.

This is an intelligent productivity operating system.

Build with startup-level quality.

Use best engineering decisions automatically.
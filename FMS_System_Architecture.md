**FURNITURE MANAGEMENT SYSTEM**

**System Architecture Document**

|  |  |
| --- | --- |
| **Document Reference** | SMS-FMS-2026-001-ARCH |
| **Version** | 1.0 |
| **Date** | June 2026 |
| **Client** | Style My Space — Mr. Gidion Deus Mboya |
| **Prepared By** | Thecla James — Software Provider |
| **Status** | Final — For Client Review |

# 1. Introduction

This document describes the system architecture for the Furniture Management System (FMS) developed for Style My Space. It is intended to serve as the technical reference for development, deployment, maintenance, and future enhancements of the system.

The FMS is a multi-role, multi-branch web application covering custom order management, workshop production, stock control, showroom management, and business reporting. It is accessed via web browsers on both desktop and mobile devices and is hosted on a dedicated Contabo server.

## 1.1 Purpose

This document covers:

* The high-level system architecture and technology choices
* The layered application architecture (frontend, backend, database)
* Module breakdown and component responsibilities
* Data flow and integration points (SMS gateway, server)
* Security architecture and role-based access control
* Deployment and infrastructure configuration
* Non-functional requirements and design decisions

## 1.2 Scope

The system serves five user roles across multiple branches of Style My Space: Front Desk Staff, Director, Operations Manager, Head Technicians (mobile), and Stock Keeper. It integrates with a third-party SMS gateway for production notifications and is deployed on a Contabo VPS.

# 2. System Overview

The FMS is a web-based application built on a client-server architecture. The backend exposes a RESTful API built with Django (Python) and the frontend is a single-page application (SPA) built with React (JavaScript). The two layers communicate exclusively via JSON over HTTPS. A relational database (PostgreSQL) stores all application data.

## 2.1 High-Level Components

|  |  |  |
| --- | --- | --- |
| **Component** | **Technology** | **Responsibility** |
| **Frontend SPA** | React (JavaScript) | User interface for all five role portals including the mobile technician portal |
| **Backend API** | Django REST Framework (Python) | **Business logic, authentication, data validation, workflow orchestration** |
| **Database** | PostgreSQL | Persistent storage for all application data — orders, users, inventory, stages, transactions |
| **Web Server** | Nginx | **Reverse proxy, SSL termination, static file serving, load balancing** |
| **Application Server** | Gunicorn (WSGI) | Runs the Django application and handles concurrent HTTP requests |
| **SMS Gateway** | Third-party provider (client-funded) | **Outbound SMS notifications to head technicians on order entry and stage activation** |
| **Hosting Infrastructure** | Contabo VPS (Ubuntu) | Virtual private server hosting all system components with dedicated resources |

## 2.2 Architecture Style

The system follows a three-tier architecture:

|  |  |  |
| --- | --- | --- |
| **Tier** | **Layer** | **Description** |
| **Tier 1** | Presentation Layer | React SPA served to the user's browser. Handles UI rendering, user input, state management, and API calls via Axios. |
| **Tier 2** | Application / Logic Layer | **Django REST API. Enforces business rules, role-based permissions, workflow transitions, and orchestrates all interactions with the database and external services.** |
| **Tier 3** | Data Layer | PostgreSQL relational database. All persistent state — orders, users, inventory, production stages, transactions — lives here. |

# 3. System Architecture Diagram

The diagram below represents the logical architecture of the FMS, showing how all components interact across layers and external integrations.

|  |  |  |
| --- | --- | --- |
|  | **CLIENT LAYER** |  |
| BROWSER (Desktop) | BROWSER (Desktop/Mobile) — Head Technician Portal | MOBILE BROWSER (Responsive) |
| Front Desk | Director | Ops Mgr | Stock Keeper | React SPA (Single Page Application) | Head Technician PIN Portal |
|  | ▼ HTTPS / REST API ▼ |  |
|  | **SERVER LAYER (Contabo VPS — Ubuntu)** |  |
|  | Nginx (Reverse Proxy + SSL Termination + Static Files) |  |
|  | Gunicorn WSGI Application Server |  |
|  | Django REST Framework (Business Logic + Auth + Workflow Engine) |  |
|  | ▼ | ▼ |
|  | PostgreSQL Database | SMS Gateway API (3rd Party) |
|  | All application data — Orders, Users, Stages, Inventory, Transactions | Outbound SMS to Technicians |

*Figure 1: FMS System Architecture — Logical Component Overview*

# 4. Frontend Architecture

The frontend is a React single-page application (SPA). It loads once in the user's browser and dynamically renders content based on the authenticated user's role. All data is fetched from the Django REST API via Axios HTTP client calls.

## 4.1 Technology Choices

|  |  |  |
| --- | --- | --- |
| **Technology** | **Purpose** | **Rationale** |
| **React** | UI Framework | Component-based architecture supports building separate role portals with shared utility components. Large ecosystem and strong TypeScript support for future enhancement. |
| **React Router** | Client-side Routing | **Enables navigation between views without full page reloads. Route guards enforce role-based access at the frontend level (backed by API authorisation).** |
| **Axios** | HTTP Client | Handles all REST API communication. Interceptors manage JWT token attachment and handle 401 responses for session expiry. |
| **React Query** | Server State Mgmt | **Manages caching, background data refresh, and loading/error states for API data, keeping dashboards up to date without manual polling.** |
| **Responsive CSS** | Mobile Compatibility | The Head Technician portal is optimised for mobile browsers using responsive layout breakpoints. No native app installation is required. |

## 4.2 Role-Based Portal Structure

Each role sees a completely separate interface. The React application uses the authenticated user's role (received from the JWT token) to determine which portal and navigation menu to render.

|  |  |  |
| --- | --- | --- |
| **Role** | **Portal** | **Key Frontend Views** |
| Front Desk Staff | Front Desk Portal | Order creation form, branch order dashboard, dispatch management, shop sales, reservation management |
| Director | Director Portal | **Price approval queue, order detail with images, cost breakdown report, payroll summary, set-breaking authorisation, inter-branch transfer approvals, full reporting dashboard** |
| Operations Manager | Ops Portal | Stage assignment panel, pipeline monitor dashboard, material request approval queue |
| Head Technician | Mobile Portal (PWA-style) | **Name + PIN login, work queue, ACTIVE/PENDING stage cards, DONE button, material request form, weekly earnings summary** |
| Stock Keeper | Stock Portal | Inventory ledger, material issuance queue, additional request processing, stock alerts |

## 4.3 Authentication Flow (Frontend)

1. User submits credentials on the login screen.

2. React sends a POST request to /api/auth/token/.

3. On success, the server returns a JWT access token and refresh token.

4. Tokens are stored in memory (access token) and an HttpOnly cookie (refresh token) to mitigate XSS risk.

5. Axios interceptor attaches the access token to every subsequent API request header.

6. On token expiry (401 response), the interceptor silently requests a new access token using the refresh token.

7. The role claim in the JWT payload determines which portal is rendered.

# 5. Backend Architecture

The backend is a Django application using the Django REST Framework (DRF) to expose a RESTful API. It handles all business logic, data validation, workflow state transitions, permissions enforcement, and integration with the SMS gateway.

## 5.1 Django Project Structure

|  |  |
| --- | --- |
| **Django App / Module** | **Responsibility** |
| **users** | Custom User model with role field (FRONT\_DESK, DIRECTOR, OPS\_MANAGER, TECHNICIAN, STOCK\_KEEPER). JWT authentication via Django rest framework-simple jwt. |
| **orders** | **Custom order creation, image uploads, order status lifecycle (PENDING → PRICE\_REVIEW → OPS\_QUEUE → IN\_PRODUCTION → WORKSHOP\_COMPLETE → DISPATCHED).** |
| **production** | Production stage model, stage assignment, technician assignment, stage state machine (PENDING → ACTIVE → DONE), automatic stage chain advancement. |
| **stock** | **Inventory ledger, material issuance records, material request workflow (PENDING → APPROVED/REJECTED → ISSUED), low-stock threshold alerts.** |
| **shop** | Showroom inventory, SKU management, set and component tracking, set-breaking workflow, reservations, sales recording, inter-branch transfer requests. |
| **notifications** | **SMS dispatch logic using the configured SMS gateway API. Handles bulk order-entry notifications and individual stage-activation messages. Logs delivery status.** |
| **reports** | Aggregation queries for cost breakdowns, payroll summaries, shop sales by branch, weekly cost reports, slow-moving stock alerts. |
| **branches** | **Branch model. All inventory, orders, and sales are scoped to a branch. Users are assigned to a branch at account creation.** |

## 5.2 API Design

The API follows RESTful conventions. All endpoints are prefixed with /api/v1/. Responses use JSON. Authentication is via JWT Bearer tokens in the Authorization header.

|  |  |  |
| --- | --- | --- |
| **Endpoint Group** | **Methods** | **Description** |
| /api/auth/token/ | POST | Obtain JWT access + refresh token pair |
| /api/auth/token/refresh/ | POST | **Refresh access token using refresh token** |
| /api/orders/ | GET, POST | List branch orders; create new custom order |
| /api/orders/{id}/ | GET, PATCH | **Order detail; update status (dispatch, price confirm)** |
| /api/orders/{id}/images/ | POST | Upload reference images for an order |
| /api/production/stages/ | GET, POST | **List stages for an order; create production stages** |
| /api/production/stages/{id}/done/ | POST | Mark stage DONE; triggers next stage activation + SMS |
| /api/stock/inventory/ | GET, POST, PATCH | **View and manage materials ledger** |
| /api/stock/issuances/ | GET, POST | Record material issuances against orders/stages |
| /api/stock/requests/ | GET, POST, PATCH | **Material requests from technicians; approval workflow** |
| /api/shop/items/ | GET, POST, PATCH | Showroom inventory per branch; item status management |
| /api/shop/sets/{id}/break/ | POST | **Director-only: authorise set breaking** |
| /api/shop/transfers/ | GET, POST, PATCH | Inter-branch transfer requests and approvals |
| /api/reports/costs/ | GET | **Weekly cost report with materials and labour breakdown** |
| /api/reports/payroll/ | GET | Weekly technician payroll summary |
| /api/reports/sales/ | GET | **Shop sales by branch** |

## 5.3 Workflow State Machines

### Order Status Lifecycle

|  |  |
| --- | --- |
| **Status** | **Description / Trigger** |
| **PENDING** | Order created by Front Desk. Awaiting Director price review. |
| **PRICE\_REVIEW** | Flagged to Director. Director confirms/assigns price. |
| **OPS\_QUEUE** | Price confirmed. Visible to Operations Manager for stage assignment. |
| **IN\_PRODUCTION** | Stages assigned and activated. Workshop executing. |
| **WORKSHOP\_COMPLETE** | All production stages marked DONE. |
| **DISPATCHED** | Front Desk confirms delivery to customer. Final state. |

### Production Stage Lifecycle

|  |  |
| --- | --- |
| **Status** | **Description / Trigger** |
| **PENDING** | Stage created and assigned. Technician notified by SMS at order entry. Not yet actionable. |
| **ACTIVE** | Activated automatically when preceding stage is marked DONE (or manually for first stage). Technician receives SMS. |
| **DONE** | Technician marks stage complete. Triggers next stage activation. Timestamped. |

# 6. Database Architecture

The system uses PostgreSQL as its relational database. Django's ORM manages schema migrations, queries, and relationships. All data is normalised to minimise redundancy and maintain referential integrity.

## 6.1 Core Data Models

### User

|  |
| --- |
| **Fields** |
| id (PK) |
| username |
| email |
| hashed\_password |
| role (enum) |
| branch (FK → Branch) |
| phone\_number |
| pin\_hash (technicians only) |
| is\_active |

### Branch

|  |
| --- |
| **Fields** |
| id (PK) |
| name |
| location |
| is\_active |

### Order (Custom)

|  |
| --- |
| **Fields** |
| id (PK) |
| reference\_number (unique) |
| branch (FK → Branch) |
| created\_by (FK → User) |
| customer\_name |
| customer\_phone |
| item\_description |
| quoted\_price |
| confirmed\_price |
| delivery\_date |
| status (enum) |
| created\_at |
| updated\_at |

### OrderImage

|  |
| --- |
| **Fields** |
| id (PK) |
| order (FK → Order) |
| image\_file |
| uploaded\_at |

### ProductionStage

|  |
| --- |
| **Fields** |
| id (PK) |
| order (FK → Order) |
| stage\_name |
| sequence\_number |
| assigned\_technician (FK → User) |
| status (enum: PENDING/ACTIVE/DONE) |
| created\_at |
| activated\_at |
| completed\_at |

### MaterialEstimate

|  |
| --- |
| **Fields** |
| id (PK) |
| stage (FK → ProductionStage) |
| material\_name |
| estimated\_quantity |
| unit |

### MaterialRequest

|  |
| --- |
| **Fields** |
| id (PK) |
| stage (FK → ProductionStage) |
| requested\_by (FK → User) |
| material\_name |
| quantity |
| status (enum: PENDING/APPROVED/REJECTED) |
| reviewed\_by (FK → User, nullable) |
| review\_reason |
| created\_at |

### InventoryItem

|  |
| --- |
| **Fields** |
| id (PK) |
| name |
| unit |
| current\_quantity |
| minimum\_threshold |
| last\_updated |

### Issuance

|  |
| --- |
| **Fields** |
| id (PK) |
| order (FK → Order) |
| stage (FK → ProductionStage) |
| inventory\_item (FK → InventoryItem) |
| quantity\_issued |
| issued\_by (FK → User) |
| issuance\_type (INITIAL/ADDITIONAL) |
| issued\_at |

### ShowroomItem

|  |
| --- |
| **Fields** |
| id (PK) |
| sku (unique per branch) |
| name |
| branch (FK → Branch) |
| category |
| price |
| status (enum: AVAILABLE/RESERVED/SOLD/TRANSFERRED/BROKEN) |
| parent\_set (FK → ShowroomItem, nullable) |
| is\_set |
| created\_at |

### Reservation

|  |
| --- |
| **Fields** |
| id (PK) |
| item (FK → ShowroomItem) |
| customer\_name |
| customer\_phone |
| deposit\_amount |
| expiry\_date |
| is\_active |
| created\_by (FK → User) |
| created\_at |

### Sale

|  |
| --- |
| **Fields** |
| id (PK) |
| item (FK → ShowroomItem) |
| branch (FK → Branch) |
| sale\_price |
| sold\_by (FK → User) |
| sold\_at |
| order\_type (SHOP/CUSTOM) |

### BranchTransferRequest

|  |
| --- |
| **Fields** |
| id (PK) |
| item (FK → ShowroomItem) |
| from\_branch (FK → Branch) |
| to\_branch (FK → Branch) |
| requested\_by (FK → User) |
| status (enum: PENDING/APPROVED/REJECTED) |
| reviewed\_by (FK → User, nullable) |
| created\_at |

### SMSLog

|  |
| --- |
| **Fields** |
| id (PK) |
| recipient\_phone |
| message\_body |
| trigger\_event |
| status (SENT/FAILED) |
| sent\_at |
| gateway\_response |

# 7. Security Architecture

## 7.1 Authentication

|  |  |
| --- | --- |
| **Mechanism** | **Detail** |
| **JWT Authentication** | All API requests (except /auth/token/) require a valid JWT Bearer token in the Authorization header. |
| **Access Token Lifetime** | **Short-lived (15–30 minutes). Stored in memory, not localStorage, to reduce XSS exposure.** |
| **Refresh Token** | Longer-lived (7 days). Stored in an HttpOnly, Secure, SameSite=Strict cookie. Never accessible to JavaScript. |
| **Technician PIN Auth** | **Head Technicians use Name + PIN. PINs are hashed (bcrypt) in the database. This authentication generates a limited-scope JWT valid only for technician endpoints.** |
| **Password Hashing** | All passwords hashed using Django's default PBKDF2-SHA256 algorithm with salting. |

## 7.2 Authorisation — Role-Based Access Control

Every API endpoint enforces role-based permissions using Django REST Framework's permission classes. The role is encoded in the JWT token payload and verified on every request.

|  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- |
| **Resource / Action** | **Front Desk** | **Director** | **Ops Mgr** | **Technician** | **Stock Keeper** |
| Create / view orders (own branch) | **✓** | **✓** | **✓** | **—** | **—** |
| Confirm order price | **—** | **✓** | **—** | **—** | **—** |
| Assign production stages | **—** | **—** | **✓** | **—** | **—** |
| Mark stage DONE | **—** | **—** | **—** | **✓** | **—** |
| Submit material request | **—** | **—** | **—** | **✓** | **—** |
| Approve material request | **—** | **—** | **✓** | **—** | **—** |
| Manage inventory | **—** | **—** | **—** | **—** | **✓** |
| Issue materials | **—** | **—** | **—** | **—** | **✓** |
| View Director reports | **—** | **✓** | **—** | **—** | **—** |
| Authorise set breaking | **—** | **✓** | **—** | **—** | **—** |
| Approve inter-branch transfers | **—** | **✓** | **—** | **—** | **—** |
| Shop sales and reservations | **✓** | **—** | **—** | **—** | **—** |

## 7.3 Transport Security

* All communication between client and server is encrypted via HTTPS (TLS 1.2+).
* Nginx handles SSL termination using a valid SSL certificate (Let's Encrypt or equivalent).
* HTTP requests are automatically redirected to HTTPS.
* CORS is configured to allow requests only from the production domain.

## 7.4 Input Validation & Security Hardening

* All user inputs validated at both the React form level (frontend) and Django serializer level (backend).
* Django's ORM parameterises all queries, preventing SQL injection.
* File uploads (order reference images) validated for type (JPG/PNG) and size before storage.
* Django's CSRF protection enabled for session-based endpoints.
* Rate limiting applied to authentication endpoints to mitigate brute-force attacks.
* Database user has least-privilege access; does not own the schema.

# 8. Integration Architecture

## 8.1 SMS Gateway Integration

The SMS gateway is a third-party service (to be selected by the client). The system integrates via the gateway's REST API using HTTP POST requests. SMS costs are borne by the client from day one of go-live.

|  |  |
| --- | --- |
| **Attribute** | **Detail** |
| **Trigger Events** | (1) Order entry — bulk SMS to all assigned technicians (PENDING notification). (2) Stage activation — individual SMS to the specific next technician (ACTIVE notification). |
| **Dispatch Method** | **Asynchronous — SMS tasks are dispatched to a background task queue (Celery + Redis) so the API response is not blocked by SMS delivery latency.** |
| **Failure Handling** | Failed SMS deliveries are logged in the SMSLog table with the gateway error response. Ops Manager receives an in-app alert for any SMS failure. |
| **Configuration** | **Gateway API key stored in environment variables (not in codebase). Gateway URL configurable without code changes.** |
| **Credit Management** | Client maintains SMS credit balance with the gateway provider. The system does not manage billing — only API integration. |

## 8.2 File Storage (Order Images)

Reference images uploaded by front desk staff are stored on the server filesystem under a protected media directory. Image files are served only to authenticated users with appropriate role access (Front Desk who uploaded, Director, Ops Manager). File paths are stored in the database; raw files are never exposed via predictable public URLs.

# 9. Deployment Architecture

## 9.1 Server Configuration (Contabo VPS)

|  |  |
| --- | --- |
| **Component** | **Configuration** |
| **Operating System** | Ubuntu 22.04 LTS (Contabo VPS) |
| **Web Server** | **Nginx — reverse proxy, SSL termination, static file serving (/static/ and /media/ directories)** |
| **WSGI Server** | Gunicorn — runs Django application with multiple worker processes (recommended: 2×CPU cores + 1) |
| **Task Queue** | **Celery with Redis as the message broker — handles asynchronous SMS dispatching** |
| **Database** | PostgreSQL — dedicated database user with restricted privileges; daily automated backups |
| **Process Manager** | **Systemd — manages Gunicorn and Celery worker processes as system services with auto-restart** |
| **SSL Certificate** | Let's Encrypt (Certbot) — auto-renewing certificate for HTTPS |
| **Environment Config** | **All secrets (DB credentials, SMS API key, Django SECRET\_KEY, JWT keys) stored in .env file outside the codebase. Loaded via python-decouple.** |

## 9.2 Request Flow

The sequence below describes how a browser request travels through the infrastructure to a response:

|  |  |  |
| --- | --- | --- |
| **#** | **Component** | **Action** |
| **1** | **Browser (HTTPS)** | User action in React SPA triggers API call via Axios |
| **2** | **Nginx** | Receives HTTPS request; terminates SSL; forwards to Gunicorn on localhost:8000 |
| **3** | **Gunicorn** | Passes request to Django application worker process |
| **4** | **Django Middleware** | JWT authentication, role permission check, request validation |
| **5** | **Django View / API** | Business logic executed; ORM queries sent to PostgreSQL |
| **6** | **PostgreSQL** | Data read/written; result returned to Django |
| **7** | **Django → Gunicorn → Nginx** | JSON response serialised and returned through the stack |
| **8** | **Browser** | React updates UI state with received data |
| **9 (async)** | **Celery Worker** | If SMS triggered: task placed on Redis queue; Celery dispatches to SMS gateway API independently |

## 9.3 Backup & Recovery

* PostgreSQL automated daily dumps stored on the server with a 14-day retention window.
* Media files (uploaded images) included in weekly server-level snapshots via Contabo's backup tools.
* In the event of database corruption, the system can be restored from the most recent nightly dump with minimal data loss.

# 10. Non-Functional Requirements

|  |  |  |
| --- | --- | --- |
| **Category** | **Requirement** | **Design Decision** |
| **Performance** | API response < 2s under normal load | Gunicorn multi-worker setup; PostgreSQL indexes on frequently queried fields (order status, branch ID, technician ID, SKU). |
| **Availability** | 99% uptime target | **Systemd auto-restarts failed processes. Contabo SLA covers infrastructure uptime. 3-month post-launch support included.** |
| **Scalability** | Multi-branch support | All data models are branch-scoped. Additional branches can be added via admin without code changes. |
| **Mobile UX** | Technician portal on mobile | **Responsive CSS with large touch targets. No app installation required. Minimal page weight for low-bandwidth connections.** |
| **Maintainability** | Readable codebase | Django app-per-module structure. DRF serializers separate validation from business logic. React components separated by role portal. |
| **Data Integrity** | No orphaned records | **Foreign key constraints enforced at database level. Django signal-based triggers for cascading status updates on stage/order transitions.** |
| **Auditability** | Action traceability | All status changes (orders, stages, issuances, approvals) record the acting user and timestamp. SMSLog records all notification attempts. |

# 11. Technology Stack Summary

|  |  |  |
| --- | --- | --- |
| **Layer** | **Technology** | **Version / Notes** |
| **Frontend** | **React** | v18+. Create React App or Vite build toolchain. |
| **Frontend** | **React Router** | v6. Client-side routing with role-based route guards. |
| **Frontend** | **Axios** | HTTP client for API communication. |
| **Frontend** | **React Query** | Server state management and caching. |
| **Backend** | **Python** | v3.11+ |
| **Backend** | **Django** | v4.2 LTS. Stable long-term support release. |
| **Backend** | **Django REST Framework** | v3.14+. API views, serializers, permissions. |
| **Backend** | **djangorestframework-simplejwt** | JWT authentication. |
| **Backend** | **Celery** | Asynchronous task processing for SMS dispatch. |
| **Database** | **PostgreSQL** | v15+. Primary relational data store. |
| **Cache / Queue** | **Redis** | Celery message broker. Optional query caching. |
| **Web Server** | **Nginx** | Reverse proxy, SSL, static file serving. |
| **App Server** | **Gunicorn** | WSGI server for Django. |
| **Infrastructure** | **Contabo VPS** | Ubuntu 22.04 LTS. Dedicated server resources. |
| **SSL** | **Let's Encrypt (Certbot)** | Free auto-renewing SSL certificates. |
| **SMS** | **Third-party SMS Gateway** | Client-funded. Configured via API key in .env. |

# 12. Document Revision History

|  |  |  |  |
| --- | --- | --- | --- |
| **Version** | **Date** | **Author** | **Description** |
| 1.0 | June 2026 | Thecla James | Initial architecture document for client review. |

*This document is the property of Thecla (Sole Proprietor — Software Provider) and is provided to Style My Space under the terms of Contract SMS-FMS-2026-001. It is confidential and may not be shared with third parties without written consent.*
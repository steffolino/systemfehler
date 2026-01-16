# API Documentation

The Systemfehler API provides REST endpoints for accessing crawled data, quality metrics, and moderation queue information.

## Base URL

```
http://localhost:3001
```

## Authentication

Currently, the API does not require authentication. Authentication will be added in a future release (PR #2).

---

## Endpoints

### Health Check

Check if the API and database are operational.

**Endpoint:** `GET /api/health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-16T12:00:00.000Z",
  "database": "connected"
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Database connection failed

---

### System Status

Get overall system statistics.

**Endpoint:** `GET /api/status`

**Response:**

```json
{
  "database": {
    "totalEntries": 123,
    "byDomain": {
      "benefits": { "active": 45, "discontinued": 5 },
      "aid": { "active": 30 },
      "tools": { "active": 20 }
    }
  },
  "moderation": {
    "pending": 12,
    "approved": 100,
    "rejected": 5
  },
  "qualityScores": {
    "avgIqs": "78.50",
    "avgAis": "82.30"
  },
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

---

### Get Entries

Retrieve entries with optional filtering and pagination.

**Endpoint:** `GET /api/data/entries`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Filter by domain (benefits, aid, tools, organizations, contacts) |
| `status` | string | Filter by status (active, discontinued, archived, under_revision) |
| `limit` | integer | Number of results per page (default: 50, max: 100) |
| `offset` | integer | Offset for pagination (default: 0) |
| `search` | string | Full-text search query |

**Example Request:**

```
GET /api/data/entries?domain=benefits&limit=10&offset=0
```

**Response:**

```json
{
  "entries": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "domain": "benefits",
      "title_de": "Bürgergeld (Arbeitslosengeld II)",
      "title_en": null,
      "title_easy_de": null,
      "summary_de": "Das Bürgergeld ist eine Leistung...",
      "content_de": "Ausführliche Informationen...",
      "url": "https://www.arbeitsagentur.de/arbeitslosengeld-2",
      "topics": ["benefits", "unemployment", "buergergeld"],
      "tags": ["arbeitslosengeld", "grundsicherung"],
      "target_groups": ["arbeitslose", "geringverdiener"],
      "status": "active",
      "first_seen": "2026-01-16T10:00:00.000Z",
      "last_seen": "2026-01-16T10:00:00.000Z",
      "provenance": {
        "source": "https://www.arbeitsagentur.de/arbeitslosengeld-2",
        "crawler": "arbeitsagentur",
        "crawledAt": "2026-01-16T10:00:00.000Z",
        "checksum": "abc123..."
      },
      "quality_scores": {
        "iqs": 85.5,
        "ais": 78.2,
        "computedAt": "2026-01-16T10:00:00.000Z"
      },
      "iqs": 85.5,
      "ais": 78.2
    }
  ],
  "total": 123,
  "limit": 10,
  "offset": 0,
  "page": 1,
  "pages": 13
}
```

---

### Get Single Entry

Retrieve a single entry by ID with domain-specific data.

**Endpoint:** `GET /api/data/entries/:id`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Entry ID |

**Example Request:**

```
GET /api/data/entries/550e8400-e29b-41d4-a716-446655440000
```

**Response:**

```json
{
  "entry": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "benefits",
    "title_de": "Bürgergeld (Arbeitslosengeld II)",
    // ... all core fields ...
    "domainData": {
      "entry_id": "550e8400-e29b-41d4-a716-446655440000",
      "benefit_amount_de": "563 Euro pro Monat für Alleinstehende",
      "eligibility_criteria_de": "Personen, die erwerbsfähig und hilfebedürftig sind...",
      "application_steps": [
        { "de": "Antrag beim Jobcenter stellen" },
        { "de": "Erforderliche Unterlagen einreichen" }
      ],
      "required_documents": [
        { "de": "Personalausweis oder Reisepass" },
        { "de": "Meldebescheinigung" }
      ]
    }
  }
}
```

**Status Codes:**
- `200 OK` - Entry found
- `404 Not Found` - Entry not found

---

### Get Moderation Queue

Retrieve pending moderation queue entries.

**Endpoint:** `GET /api/data/moderation-queue`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (default: pending) |
| `domain` | string | Filter by domain |
| `limit` | integer | Number of results (default: 100, max: 100) |
| `offset` | integer | Offset for pagination (default: 0) |

**Example Request:**

```
GET /api/data/moderation-queue?status=pending
```

**Response:**

```json
{
  "queue": [
    {
      "id": "queue-entry-id",
      "entry_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain": "benefits",
      "action": "update",
      "status": "pending",
      "candidate_data": { /* new entry data */ },
      "existing_data": { /* current entry data */ },
      "diff": {
        "type": "update",
        "added": {},
        "modified": {
          "summary_de": {
            "old": "Old summary",
            "new": "New summary"
          }
        },
        "removed": {},
        "unchanged": {}
      },
      "provenance": {
        "source": "https://example.com",
        "crawler": "arbeitsagentur",
        "crawledAt": "2026-01-16T10:00:00.000Z"
      },
      "created_at": "2026-01-16T10:00:00.000Z",
      "title_de": "Bürgergeld",
      "url": "https://www.arbeitsagentur.de/arbeitslosengeld-2"
    }
  ],
  "total": 12,
  "status": "pending",
  "domain": null
}
```

---

### Get Quality Report

Retrieve comprehensive quality metrics and reports.

**Endpoint:** `GET /api/data/quality-report`

**Response:**

```json
{
  "byDomain": {
    "benefits": {
      "totalEntries": 50,
      "activeEntries": 45,
      "avgIqs": "78.50",
      "avgAis": "82.30",
      "missingEnTranslation": 30,
      "missingEasyDeTranslation": 40
    },
    "aid": {
      "totalEntries": 30,
      "activeEntries": 28,
      "avgIqs": "75.20",
      "avgAis": "79.10",
      "missingEnTranslation": 20,
      "missingEasyDeTranslation": 25
    }
  },
  "lowQualityEntries": [
    {
      "id": "entry-id",
      "domain": "benefits",
      "title": "Entry Title",
      "url": "https://example.com",
      "iqs": 45.5,
      "ais": 38.2
    }
  ],
  "missingTranslations": [
    {
      "id": "entry-id",
      "domain": "benefits",
      "title": "Entry Title",
      "url": "https://example.com",
      "missingEn": true,
      "missingEasyDe": true
    }
  ]
}
```

---

## Error Responses

All endpoints may return error responses with the following format:

```json
{
  "error": "Error message",
  "message": "Detailed error information (development only)"
}
```

**Common Status Codes:**
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Database unavailable

---

## CORS

The API allows cross-origin requests from `http://localhost:5173` (frontend development server) by default.

To configure CORS for production, set the `CORS_ORIGIN` environment variable.

---

## Rate Limiting

Currently, no rate limiting is implemented. Rate limiting will be added in a future release.

---

## Future Endpoints (Planned)

The following endpoints will be added in future releases:

- `POST /api/auth/login` - User authentication (PR #2)
- `POST /api/moderation/approve` - Approve moderation entry (PR #2)
- `POST /api/moderation/reject` - Reject moderation entry (PR #2)
- `GET /api/search` - Advanced search with filters (PR #3)
- `GET /api/analytics` - Detailed analytics (PR #2)

---

## Development

To start the API server for development:

```bash
npm run api
```

The server will run on port 3001 by default. Change this with the `API_PORT` environment variable.

### Testing Endpoints

Use curl to test endpoints:

```bash
# Health check
curl http://localhost:3001/api/health

# Get entries
curl "http://localhost:3001/api/data/entries?domain=benefits&limit=5"

# Get quality report
curl http://localhost:3001/api/data/quality-report
```

Or use tools like:
- Postman
- Insomnia
- HTTPie
- Browser DevTools

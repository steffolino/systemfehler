# Systemfehler MVP Architecture

The Minimum Viable Product (MVP) consists of a Vue.js frontend, a Python backend (e.g., FastAPI), and a database.

## Overview

```mermaid
graph TD
  A[Vue Frontend] -- REST API --> B[Python Backend]
  B -- DB Queries --> C[(Database)]
  A -- Auth, Forms, Directory --> A
  B -- User, Case, Resource Models --> B

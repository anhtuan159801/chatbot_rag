# Chatbot RAG

This is a chatbot application with Retrieval Augmented Generation (RAG).

## Prerequisites

- Docker
- Docker Compose

## Getting Started

1.  **Create a `.env` file** from the `.env.example` file and fill in the required environment variables.

    ```bash
    cp .env.example .env
    ```

2.  **Build and run the application** using Docker Compose.

    ```bash
    docker-compose up --build
    ```

The application will be available at `http://localhost:8080`.

<div align="center">

# PurpRev

<img src="images/nonelogo.png" alt="Logo" width="320">

PurpRev is both a backend and frontend for [NoneRev](https://nonerev.pw).
<br>
**A revival that goes for the win.**

</div>

## Tech Stack

| Part | Built with |
| - | - |
| Frontend | [Svelte 5](https://svelte.dev) and [Vite](https://vite.dev) |
| Backend  | [Bun](https://bun.com) and [Elysia](https://elysiajs.com), API docs made by its OpenAPI plugin |
| Database | [MySQL](https://www.mysql.com) |

## Requirements

It really depends on how you run it, you can pick one below:

| Way                           | You need                                                             |
| - | - |
| [Local](#local)               | [Bun](https://bun.com) v1.4 or newer and a [MySQL](https://www.mysql.com) database |
| [Docker](#docker)             | [Docker](https://www.docker.com) with compose |
| [Podman](#podman-quadlets)    | [Podman](https://podman.io) on a machine with systemd |

## Setup

All three ways start the same.

**1. Clone the repo**

```bash
git clone https://github.com/nonerev/purprev.git
cd purprev
```

**2. Edit your `.env`**

```bash
cp .env.example .env
```

| Variable | What does it do? |
| - | - |
| `VITE_PORT` | Port of the frontend |
| `API_PORT` | Port of the backend |
| `MYSQL_HOST` | Where the database is, `localhost` if its on the same machine |
| `MYSQL_PORT` | `3306` unless you changed it |
| `MYSQL_DATABASE` | Name of the database |
| `MYSQL_USER` | Database login |
| `MYSQL_PASSWORD` | Database password |
| `RCCMANAGER_HOST` | Where RCCManager is, `localhost` if its on the same machine |
| `RCCMANAGER_PORT` | RCCManager binding port, default `25500` |
| `RCCMANAGER_PASSWORD` | RCCManager password |
| `ROBLOX_COOKIE` | A `.ROBLOSECURITY` cookie, needed for pulling assets from Roblox |

> [!WARNING]
> Do not commit `.env`. and PLEASE use throwaway account for `ROBLOX_COOKIE`.

In Docker and Podman the database is its own container, so `MYSQL_HOST` and `MYSQL_PORT` get set for you. The database, user and password still come from `.env`.

## Running

### Locally (usually dev environment)

Setup a MySQL server and make a database and a user that match your `.env`:

```sql
CREATE DATABASE nonerev;
CREATE USER 'nonerev'@'%' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON nonerev.* TO 'nonerev'@'%';
```

After that, install the dependencies:

```bash
bun install
```

Then run these in two terminals:

```bash
# API
bun run dev

# frontend
bun run dev:web
```

`bun run start` runs the API without the watcher.

### Docker

Build the image and start teh database, api and frontend:

```bash
docker compose up -d --build
```

```bash
# see what its doing
docker compose logs -f

# stop it, you can add -v to also delete the database
docker compose down
```

### Podman quadlets

TBA!!!

### Where everything is

Same for all three:

| What     | Where                           |
| -------- | ------------------------------- |
| Frontend | `http://localhost:5173`         |
| API      | `http://localhost:3000`         |
| API docs | `http://localhost:3000/openapi` |

Vite does proxy `/api` to the backend, so `http://localhost:5173/api` works too.

## License

[AGPL-3.0](LICENSE). If you host a modified version, you have to share your changes with the people using it.

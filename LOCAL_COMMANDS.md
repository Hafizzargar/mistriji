# MistriJi Local Commands Quick Guide

## 🚀 Quick Launch (One-Click / Command)
Double-click `run-local.bat` or run in terminal:
```cmd
.\run-local.bat
```

---

## 🛠 Manual Terminal Commands

### Run All Services Together:
```bash
npm run dev
# OR
pnpm dev
```

### Run Individual Apps:

1. **Web App (Customer & Worker Portal)**
   ```bash
   npm run dev:web
   ```

2. **Admin Portal**
   ```bash
   npm run dev:admin
   ```

3. **Backend API (Auth / SMS / Email)**
   ```bash
   npm run dev:api
   ```

---

## 🏗 Build Commands

- **Build Admin:** `npm run build:admin`
- **Build Web:** `npm run build:web`

# Social login (MetaMask Embedded Wallets)

Oscorp uses [MetaMask Embedded Wallets](https://docs.metamask.io/embedded-wallets) (Web3Auth) for Google, email, and other social logins on **Algorand TestNet**, via `@txnlab/use-wallet`.

## 1. Create a project

1. Sign in at [developer.metamask.io](https://developer.metamask.io/).
2. Create a new **Embedded Wallets** project (use **Sapphire Devnet** for local dev).
3. Copy the **Client ID** from **Project → General**.

## 2. Allow your app URL

In the dashboard, add these to **Allowed origins** / whitelist:

- `http://localhost:8080`
- `http://127.0.0.1:8080`

(Adjust if your Vite port differs.)

## 3. Enable login methods

Under **Social connections** (or Authentication), enable the providers you want (e.g. Google, email passwordless).

## 4. Set the frontend env var

```bash
# From repo root — paste Client ID when prompted
./scripts/setup-web3auth.sh

# Or pass it directly:
./scripts/setup-web3auth.sh YOUR_CLIENT_ID_HERE
```

Or edit `frontend/.env` manually:

```env
VITE_WEB3AUTH_CLIENT_ID=your_client_id_here
```

## 5. Restart Vite

```bash
cd Oscorp/frontend
npm run dev
```

The **Google, email & more** button should be enabled and open the Web3Auth popup.

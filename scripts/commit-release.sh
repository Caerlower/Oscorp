#!/usr/bin/env bash
# Staged release commits for Oscorp v2 — run from repo root.
set -euo pipefail
cd "$(dirname "$0")/.."

commit() {
  local msg="$1"
  shift
  if git diff --cached --quiet; then
    git add "$@"
    if git diff --cached --quiet; then
      echo "SKIP (empty): $msg"
      return 0
    fi
  fi
  git commit -m "$msg"
  echo "OK: $msg"
}

# 1
git add -u provider-services/ docker/Dockerfile.x402-provider
commit "chore: remove legacy provider-services microservices"

# 2
git add -u integrations/ supabase/
commit "chore: remove openclaw integrations and root supabase migration"

# 3
git add -u \
  backend/app/agent/ \
  backend/app/telegram/ \
  backend/app/providers/ \
  backend/app/services/ \
  backend/app/utils/ \
  backend/app/api/routes/
commit "chore(backend): remove telegram bot and legacy growth services"

# 4
git add shared/
commit "feat(shared): add canonical payment constants manifest"

# 5
git add \
  backend/app/core/__init__.py \
  backend/app/core/groq_client.py \
  backend/app/core/json_utils.py \
  backend/app/blockchain/
commit "feat(backend): add groq client and algorand blockchain helpers"

# 6
git add backend/app/core/payment_constants.py backend/app/core/x402_middleware.py
commit "feat(backend): add x402 middleware and payment constant loader"

# 7
git add backend/app/analytics/
commit "feat(backend): add website analytics and firecrawl scraping pipeline"

# 8
git add \
  backend/app/agents/reddit/ \
  backend/app/agents/twitter/ \
  backend/app/agents/linkedin/
commit "feat(backend): add reddit, twitter, and linkedin agents"

# 9
git add \
  backend/app/agents/articles/ \
  backend/app/agents/hackernews/
commit "feat(backend): add articles and hackernews agents"

# 10
git add \
  backend/app/chat/ \
  backend/app/payments/ \
  backend/app/workspace/ \
  backend/app/db/
commit "feat(backend): add chat, payments, workspace, and supabase client"

# 11
git add backend/app/routes/
commit "feat(backend): add session, agents, analysis, and deliverable routes"

# 12
git add backend/app/api/main.py backend/app/config/ backend/pyproject.toml backend/pnpm-lock.yaml
commit "feat(backend): wire FastAPI app to new route modules"

# 13
git add backend/supabase/ backend/tests/
commit "test(backend): add supabase schema and payment constants sync tests"

# 14
git add -u docker/ scripts/ backend/.env.example backend/README.md
commit "chore(backend): update docker images and dev stack scripts"

# 15
git add x402-payer/
commit "feat(x402-payer): add browser x402 fetch helper for Algorand USDC"

# 16
git add -u \
  frontend/src/components/ui/ \
  frontend/src/components/AppShell.tsx \
  frontend/src/components/ConnectWalletButton.tsx \
  frontend/src/components/LandingNav.tsx \
  frontend/src/components/Logo.tsx \
  frontend/src/components/PageHeader.tsx \
  frontend/src/components/PaymentReceipt.tsx \
  frontend/src/components/SetupChecklist.tsx \
  frontend/src/components/WalletBrandIcon.tsx \
  frontend/src/components/WalletConnectPanel.tsx \
  frontend/src/components/WalletProviders.tsx \
  frontend/src/components/WalletSessionBridge.tsx \
  frontend/src/components/app/ \
  frontend/src/components/landing/ \
  frontend/src/routes/agent.tsx \
  frontend/src/routes/drafts.tsx \
  frontend/src/routes/onboarding.tsx \
  frontend/src/hooks/use-mobile.tsx \
  frontend/src/hooks/useSessionRedirect.ts \
  frontend/bun.lock \
  frontend/bunfig.toml \
  frontend/public/wallets/lute.png
commit "chore(frontend): remove legacy scaffold components and unused UI kit"

# 17
git add \
  frontend/src/components/wallet/ \
  frontend/src/services/web3auth-connect.ts \
  frontend/src/services/auth.ts \
  frontend/src/utils/wallet-logos.ts \
  frontend/src/utils/preload-wallet-deps.ts \
  frontend/src/utils/algorand-wallet.ts \
  frontend/src/hooks/useWalletConnect.ts \
  frontend/src/hooks/useWalletUsdcBalances.ts \
  frontend/src/hooks/useTransactionSigner.ts \
  frontend/src/context/transaction-signer-context.ts
commit "feat(frontend): add wallet connect flow with Pera, Defly, and Web3Auth"

# 18
git add \
  frontend/src/services/http-response.ts \
  frontend/src/services/api.ts \
  frontend/src/services/x402-api.ts \
  frontend/src/hooks/useX402Fetch.ts \
  frontend/src/hooks/usePayment.ts \
  frontend/src/hooks/usePaymentUser.ts \
  frontend/src/context/PaymentContext.tsx \
  frontend/src/context/PaymentUserContext.tsx \
  frontend/src/context/PaidAgentsContext.tsx \
  frontend/src/context/payment-context-state.ts \
  frontend/src/utils/payment-receipt.ts \
  frontend/src/constants/payment-constants.ts \
  frontend/src/types/payment-user.ts \
  frontend/src/components/payment/
commit "feat(frontend): add x402 payment flow and agent wallet modals"

# 19
git add \
  frontend/src/context/ThemeContext.tsx \
  frontend/src/context/SessionContext.tsx \
  frontend/src/context/AnalysisContext.tsx \
  frontend/src/context/CompanyProfileContext.tsx \
  frontend/src/context/WorkspaceContext.tsx \
  frontend/src/hooks/useAuth.ts \
  frontend/src/hooks/useFullAnalysis.ts \
  frontend/src/hooks/useAgentsFeed.ts \
  frontend/src/hooks/useCmoChat.ts \
  frontend/src/hooks/useProfileIdentity.ts \
  frontend/src/types/ \
  frontend/src/utils/agent-context.ts \
  frontend/src/utils/agent-wallet.ts \
  frontend/src/utils/company-profile.ts \
  frontend/src/utils/chat-context.ts \
  frontend/src/utils/edited-documents.ts \
  frontend/src/utils/navigation.ts \
  frontend/src/utils/polyfills.ts \
  frontend/src/services/workspace-sync.ts \
  frontend/src/constants/config.ts \
  frontend/src/constants/oscorp-theme.ts \
  frontend/src/constants/detail-agent-theme.ts \
  frontend/src/constants/landing-data.ts
commit "feat(frontend): add session, analysis, and workspace state layer"

# 20
git add \
  frontend/src/components/mission-control/ \
  frontend/src/components/OscorpChrome.tsx \
  frontend/src/components/OscorpBrandMark.tsx \
  frontend/src/components/ThemeSwitch.tsx \
  frontend/src/components/RequireSession.tsx \
  frontend/src/routes/dashboard.tsx \
  frontend/src/routes/auth.tsx \
  frontend/src/routes/profile.tsx
commit "feat(frontend): add mission control dashboard shell"

# 21
git add \
  frontend/src/components/dashboard/ \
  frontend/src/components/chat/ \
  frontend/src/components/MarkdownContent.tsx \
  frontend/src/components/onboarding/
commit "feat(frontend): add dashboard panels, CMO chat, and company intel"

# 22
git add frontend/src/components/settings/ frontend/src/routes/settings.tsx
commit "feat(frontend): add settings pages with transaction history"

# 23
git add \
  frontend/src/components/layout/ \
  frontend/src/routes/index.tsx \
  frontend/src/assets/
commit "feat(frontend): rebuild landing page and marketing layout"

# 24
git add \
  frontend/src/routes/__root.tsx \
  frontend/src/routeTree.gen.ts \
  frontend/src/server.ts \
  frontend/src/start.ts \
  frontend/src/styles.css \
  frontend/src/components/ui/accordion.tsx \
  frontend/src/components/ui/dropdown-menu.tsx \
  frontend/src/components/ui/sonner.tsx \
  frontend/scripts/ \
  frontend/package.json \
  frontend/package-lock.json \
  frontend/pnpm-lock.yaml \
  frontend/vite.config.ts \
  frontend/tsconfig.json \
  frontend/components.json \
  frontend/wrangler.jsonc \
  frontend/.env.example
commit "chore(frontend): update build config, styles, and pnpm toolchain"

# 25
git add README.md docs/x402.md frontend/README.md .gitignore Oscorp.code-workspace
commit "docs: rewrite README and add x402 integration guide"

echo "Done. $(git rev-list --count HEAD ^origin/main 2>/dev/null || git rev-list --count HEAD) commits ahead."

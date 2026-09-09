// ==========================================================================
// Configuração do Firebase.
// Preencha com as chaves do SEU projeto novo (Console do Firebase →
// Configurações do projeto → Seus apps → Config do SDK).
// Essas chaves são públicas por natureza (não são segredo) — quem protege
// os dados são as Regras do Firestore (veja README.md), não esta config.
// ==========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDwk2wfuFd1KH67RYi_swfelFV7miq62so",
  authDomain: "dashborad-financeiro-db031.firebaseapp.com",
  projectId: "dashborad-financeiro-db031",
  storageBucket: "dashborad-financeiro-db031.firebasestorage.app",
  messagingSenderId: "1075332417970",
  appId: "1:1075332417970:web:2869277695d0bde3b6fcab",
  measurementId: "G-YBSNLYF40S"
};

// Credenciais da conta de demonstração (mostrada no portfólio).
// Crie esse usuário no Firebase Auth (email/senha) e rode o script de seed
// (ver README) para popular os meses de exemplo.
export const DEMO_EMAIL = "demo@dashboard-financas.app";
export const DEMO_PASSWORD = "demo123456";

// Senha fixa usada para abrir os boletos em PDF do C6 enviados pela conta real.
export const C6_PDF_PASSWORD = "115340";

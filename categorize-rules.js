// ==========================================================================
// Regras de categorização automática das transações do boleto do cartão.
// Cada regra é testada na ordem em que aparece — a primeira que bater vence.
// Edite/adicione padrões livremente; "pattern" é um regex (case-insensitive).
// ==========================================================================

export const CATEGORIES = [
  'Supermercado',
  'Compras online',
  'Pet / Agropecuária',
  'Farmácia',
  'Auto / Combustível',
  'Padaria / Doces',
  'Viagem / Hospedagem',
  'Seguro',
  'Vestuário / Loja',
  'Assinaturas / Cursos',
  'Tarifas do cartão',
  'Transferências / Diversos',
];

const RULES = [
  { category: 'Tarifas do cartão', pattern: /ANUIDADE|TARIFA|ESTORNO|IOF\b|JUROS/i },
  { category: 'Supermercado', pattern: /SUPERMEC|SUPERMERC|ATACADIST|MERCEARIA/i },
  { category: 'Compras online', pattern: /MERCADOLIVRE|MERCADO\s?LIVRE|SHOPEE|AMAZON|ALIEXPRESS/i },
  { category: 'Pet / Agropecuária', pattern: /RA[CÇ]AO|PET\b|AGROPECUAR/i },
  { category: 'Farmácia', pattern: /DROGARIA|FARMACIA|DROGASIL|PACHECO/i },
  { category: 'Auto / Combustível', pattern: /\bAUTO\b|POSTO\b|MOTORCYCLE|PE[CÇ]AS|OFICINA|IPVA/i },
  { category: 'Padaria / Doces', pattern: /PADARIA|PANIFICAC|SORVETERIA|ACAITERIA|CONFEITARIA|DOCERIA/i },
  { category: 'Viagem / Hospedagem', pattern: /AIRBNB|HOTEL|POUSADA|DECOLAR|LATAM|GOL\s|AZUL\sLINHAS|IATA|PASSAGEM/i },
  { category: 'Seguro', pattern: /SEGURO/i },
  { category: 'Vestuário / Loja', pattern: /AMERICANAS|RIACHUELO|C\s?&\s?A\b|RENNER|LOJAS\s/i },
  { category: 'Assinaturas / Cursos', pattern: /AUVP|ESCOLA|PASSAPOR|NETFLIX|SPOTIFY|ASSINATURA|CURSO|JIM\.COM/i },
  // Mercado Pago (MP *) e transferências entre pessoas caem em Diversos por padrão —
  // fica fácil reclassificar manualmente na tabela depois do upload.
];

/**
 * Classifica uma descrição de transação do boleto em uma categoria.
 * @param {string} description
 * @returns {string} nome da categoria
 */
export function categorize(description) {
  const desc = (description || '').toUpperCase();
  for (const rule of RULES) {
    if (rule.pattern.test(desc)) return rule.category;
  }
  return 'Transferências / Diversos';
}

export function getRules() {
  return RULES.map(r => ({ category: r.category, pattern: r.pattern.source }));
}

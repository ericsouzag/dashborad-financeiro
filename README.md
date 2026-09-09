# Painel Financeiro

Controle de gastos mensais com análise das faturas do cartão C6, instalável como
ícone na tela inicial do celular.

## O que já está pronto

- Login com três modos: conta pessoal, demonstração (somente leitura) e painel de teste
- Formulário mensal com os campos da planilha original e o cálculo replicado
  (abatimento do Stev, diferença Itaú/Gabriel, total e total + investimentos)
- Leitura do PDF da fatura do C6 direto no navegador, com senha aplicada
  automaticamente na conta pessoal
- Categorização automática das compras por nome do estabelecimento, com ajuste manual
- Gráficos de total por mês, gastos fixos vs. média, e comparativo do cartão
  por categoria (mês x média x mês anterior)
- Setembro e dezembro de 2025 ficam fora de todas as médias

## Como colocar no ar

### 1. Criar o projeto no Firebase

1. Acesse console.firebase.google.com e crie um projeto novo.
2. Em **Authentication → Métodos de login**, ative **E-mail/senha** e **Anônimo**.
3. Em **Authentication → Users**, crie duas contas:
   - a sua conta pessoal (o e-mail que você vai usar para entrar);
   - a conta de demonstração: `demo@dashboard-financas.app`, senha `demo123456`.
4. Em **Firestore Database**, crie o banco em modo de produção.
5. Em **Configurações do projeto → Seus apps → Web**, registre um app e copie o
   objeto de configuração.

### 2. Preencher a configuração

Abra `js/firebase-config.js` e cole os valores copiados no passo anterior.
Se quiser outro e-mail/senha para a demonstração, altere ali também.

### 3. Regras do Firestore

Em **Firestore → Regras**, cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Isso garante que cada usuário só enxerga os próprios dados. Ninguém que abrir a
demonstração ou o painel de teste consegue ler os seus meses.

### 4. Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "Painel financeiro"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Em um ou dois minutos o site fica em `https://SEU-USUARIO.github.io/SEU-REPO/`.

Depois, no Firebase, vá em **Authentication → Settings → Domínios autorizados** e
adicione `SEU-USUARIO.github.io`. Sem isso o login não funciona.

### 5. Instalar no celular

Abra o site no Chrome (Android) ou Safari (iPhone) e use
**Adicionar à tela de início**. Ele abre em tela cheia, sem barra do navegador,
com ícone próprio.

## Ajustar as categorias

As regras ficam em `js/categorize-rules.js`. Cada linha é um padrão de texto
ligado a uma categoria, testado na ordem em que aparece. Para incluir uma loja
nova, adicione o nome dela ao padrão da categoria certa. As correções feitas na
tela de upload valem só para aquela fatura; a regra vale para todas as futuras.

## Estrutura

```
index.html              tela de login e shell do app
css/style.css           tokens de cor, tipografia e componentes
js/firebase-config.js   chaves do projeto (você preenche)
js/auth.js              login, logout e tipo de conta
js/data.js              leitura/escrita no Firestore e o cálculo do mês
js/pdf-parser.js        leitura do boleto em PDF
js/categorize-rules.js  regras de categorização
js/dashboard.js         médias, comparativos e gráficos
js/app.js               controlador da interface
manifest.json, sw.js    instalação como app na tela inicial
```

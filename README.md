# Ent'Artes — Sistema de Gestão de Escola de Dança (Frontend)

Este repositório contém o **Frontend** do projeto **Ent'Artes**, um sistema de gestão integrada desenvolvido para digitalizar e automatizar os processos operacionais, pedagógicos e financeiros de uma escola de dança. 

O projeto é desenvolvido em contexto real, tendo a Ent'Artes como entidade parceira, no âmbito da disciplina de **Programação Web** da Licenciatura em Engenharia de Sistemas Informáticos (LESI) — **IPCA 2025/2026** (Projeto 50+10).

---

## 🎯 Sobre o Projeto

A Ent'Artes dependia de processos manuais para gerir inscrições, horários, pagamentos e comunicação interna. Esta interface Web foi desenhada para centralizar a experiência do utilizador, dividida por perfis de acesso (**Coordenação, Professor, Encarregado/Aluno**), respondendo a fluxos complexos como a validação tripla de aulas e o marketplace de figurinos.

---

## 🛠️ Stack Tecnológica (Frontend)

* **Framework:** [Next.js](https://nextjs.org/) (Utilizando o sistema moderno de **App Router**)
* **Biblioteca Base:** [React 18](https://react.dev/)
* **Linguagem:** [TypeScript](https://www.typescriptlang.org/) / JavaScript
* **Estilização:** [Tailwind CSS](https://tailwindcss.com/) (Utility-first)
* **Comunicação com a API:** Fetch API / Axios (Consumo da API RESTful em Spring Boot)

---

## ✨ Módulos e Funcionalidades Consumidas

A interface foi estruturada para refletir diretamente as regras de negócio e endpoints do Backend:

* **🔐 Autenticação & RBAC (`/login`, `/recuperaPassword`):** Controlos de sessão baseados em JWT com renderização condicional de menus conforme o perfil (Coordenação, Professor, Encarregado ou Aluno).
* **📅 Horários e Aulas (`/horarios`, `/eventos`):** Visualização de horários semanais fixos e marcação de sessões de *coaching* personalizadas em tempo real.
* **✅ Validação de Aulas (`/eventosCoordenacao`):** Painel interativo para confirmação de aulas (Professor ➔ Aluno/Encarregado ➔ Coordenação).
* **🚫 Assiduidade (`/faltas`):** Registo de faltas de alunos/professores e submissão/análise de justificações com prazos.
* **👗 Inventário e Marketplace (`/inventario`, `/marketplace`):** Catálogo digital de figurinos com filtros por tamanho, modalidade e estado, além do fluxo de doações.
* **💬 Comunicação & Notificações (`/mensagens`):** Chat interno privado entre encarregados e utilizadores autorizados e central de notificações *in-app*.
* **💶 Faturação (`/pagamentos`):** Visualização de relatórios financeiros aula a aula e exportação de dados analíticos.

---

## 🏗️ Arquitetura de Comunicação

O Frontend funciona de forma desacoplada seguindo o modelo Cliente-Servidor:

```
┌─────────────────────────┐               ┌───────────────────────────┐
│     NEXT.JS CLIENT      │   HTTP REST   │      SPRING BOOT API      │
│  (React + Tailwind)     │ ◄───────────► │  (Controllers -> Services)│
│  Rotas na pasta /app    │     JSON      │  Base de Dados: MySQL     │
└─────────────────────────┘               └───────────────────────────┘
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* **Node.js** (Versão 18 ou superior)
* Gestor de pacotes **npm**

### 1. Instalar as Dependências
Na raiz do projeto clonado, execute o comando para instalar as bibliotecas necessárias:
```bash
npm install
```

### 2. Executar em Ambiente de Desenvolvimento
Para iniciar o servidor local do Next.js:
```bash
npm run dev
```

A aplicação ficará disponível no seu navegador em: [http://localhost:3000](http://localhost:3000)

---

## 👥 Equipa (Grupo 06)

* **Diogo Silva** (Nº 31504) — *Product Owner / Líder*
* **Rodrigo Miranda** (Nº 31509) — *Scrum Master / Secretário*
* **Alexandre Barbosa** (Nº 31539) — *Developer*
* **Hugo Carvalho** (Nº 31519) — *Developer*
* **Rui Barbosa** (Nº 31515) — *Developer*


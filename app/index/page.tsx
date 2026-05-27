import React from 'react';


const LandingPage = () => {
  // Mapeamento dos itens da sua imagem para ícones e descrições
  const navigationItems = [
    { name: 'Eventos', icon: '📅', path: '/eventos' },
    { name: 'Faltas', icon: '❌', path: '/faltas' },
    { name: 'Horários', icon: '⏰', path: '/horarios' },
    { name: 'Inventário', icon: '📦', path: '/inventario' },
    { name: 'Login', icon: '🔑', path: '/login' },
    { name: 'Marketplace', icon: '🛍️', path: '/marketplace' },
    { name: 'Marketplace Coordenação', icon: '🛡️', path: '/marketplaceCoordenacao' },
    { name: 'Mensagens', icon: '💬', path: '/mensagens' },
    { name: 'Pagamentos', icon: '💳', path: '/pagamentos' },
    { name: 'Recuperar Password', icon: '🔐', path: '/recuperaPassword' },
    { name: 'Utilizadores', icon: '👥', path: '/utilizadores' },
    { name: 'EventosCoordenacao', icon: '📅', path: '/eventoscoordenacao' },
    { name: 'Modalidades', icon: '👯', path: '/modalidades' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Entartes</h1>
          <nav className="hidden md:flex gap-6 text-sm font-medium">
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <section className="mb-12 text-center md:text-left">
          <h2 className="text-4xl font-extrabold mb-4 tracking-tight">
            Bem-vindo ao Portal de Gestão
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl">
            Aceda rapidamente a todas as ferramentas de administração e operação através dos módulos abaixo.
          </p>
        </section>

        {/* Grid de Navegação baseada nas suas pastas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {navigationItems.map((item) => (
            <a
              key={item.name}
              href={item.path}
              className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col items-start"
            >
              <div className="text-2xl mb-4">
                {item.icon}
                </div>
              <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
              <p className="text-sm text-gray-500">
                Gerir módulo de {item.name.toLowerCase()}.
              </p>
              <span className="mt-4 text-blue-600 text-sm font-medium flex items-center gap-1 group-hover:underline">
                Aceder agora →
              </span>
            </a>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 bg-white border-t text-center text-gray-400 text-sm">
        <p>&copy; 2024 Sua Empresa. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
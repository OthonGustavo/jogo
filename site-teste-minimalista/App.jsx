import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiOrchestrator } from './ai-orchestrator';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// --- ÍCONES SVG ---
const IconEmail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
);

const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);

const IconFacebook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);

const IconInstagram = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
);

const IconLinkedin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
);

// --- 1. IDENTIDADE VISUAL E CONTATOS (Header) ---
const Header = ({ setActivePage }) => (
  <header className="header">
    <div className="logo" onClick={() => setActivePage('home')} style={{ cursor: 'pointer' }}>
      <img src="/images/logo.png" alt="Ademir Meira Advocacia" className="logo-img" />
    </div>
    <div className="contact-area">
      <div className="social-icons">
        {/* Ícones de Contato Direto */}
        <a href="mailto:contato@ademirmeira.adv.br" className="social-item" title="Email"><IconEmail /></a>
        <a href="tel:+5579996403775" className="social-item" title="Telefone"><IconPhone /></a>
        
        {/* Divisor Sutil se necessário ou apenas espaço */}
        <span className="icon-divider"></span>

        {/* Redes Sociais */}
        <a href="https://web.facebook.com/meiraadvocacia?_rdc=1&_rdr#" target="_blank" rel="noopener noreferrer" className="social-item" title="Facebook"><IconFacebook /></a>
        <a href="https://www.instagram.com/ademirmeiraadvocacia/" target="_blank" rel="noopener noreferrer" className="social-item" title="Instagram"><IconInstagram /></a>
        <a href="#linkedin" className="social-item" title="Linkedin"><IconLinkedin /></a>
      </div>
    </div>
  </header>
);

// --- 2. NAV BAR (Com Alternador de Tema) ---
const Navbar = ({ toggleTheme, theme, setActivePage, activePage }) => (
  <nav className="navbar">
    <ul className="nav-links">
      <li><a href="#home" onClick={() => setActivePage('home')} className={activePage === 'home' ? 'active' : ''}>Home</a></li>
      <li><a href="#sobre" onClick={() => setActivePage('sobre')} className={activePage === 'sobre' ? 'active' : ''}>Sobre Nós</a></li>
      <li><a href="#servicos" onClick={() => setActivePage('servicos')} className={activePage === 'servicos' ? 'active' : ''}>Serviços</a></li>
      <li><a href="#portfolio" onClick={() => setActivePage('portfolio')} className={activePage === 'portfolio' ? 'active' : ''}>Portfólio</a></li>
      <li><a href="#faq" onClick={() => setActivePage('faq')} className={activePage === 'faq' ? 'active' : ''}>FAQ</a></li>
      <li><a href="#blog" onClick={() => setActivePage('blog')} className={activePage === 'blog' ? 'active' : ''}>Blog</a></li>
      <li><a href="#contact" onClick={() => setActivePage('contact')} className={activePage === 'contact' ? 'active' : ''}>Contato</a></li>
      <li><a href="#extractor" onClick={() => setActivePage('extractor')} className={activePage === 'extractor' ? 'active' : ''}>Extração PDF</a></li>
    </ul>
    <button className="theme-toggle" onClick={toggleTheme}>
      {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
    </button>
  </nav>
);

// --- 3. CONTEÚDO PADRÃO ---
// --- 3. CONTEÚDO PADRÃO E PÁGINAS ---
const Home = ({ setActivePage }) => (
  <main className="main-content">
    <section className="hero-section">
      <h1>Excelência Jurídica em Cada Detalhe</h1>
      <p>Defesa estratégica e personalizada nas áreas Trabalhista, Cível e Previdenciária. Compromisso com a justiça e a proteção dos seus direitos.</p>
      <button className="btn-send" onClick={() => setActivePage('contact')} style={{marginTop: '2rem'}}>
        <span>Agende uma Consultoria Especializada</span>
      </button>
    </section>

    <div className="content-grid">
      <div className="card">
        <h3>Experiência Comprovada</h3>
        <p>Anos de atuação dedicada a casos complexos, garantindo resultados sólidos para nossos clientes através de uma análise técnica rigorosa.</p>
      </div>
      <div className="card">
        <h3>Atendimento Humanizado</h3>
        <p>Entendemos que cada caso é único. Oferecemos um acompanhamento próximo e transparente em todas as etapas do processo.</p>
      </div>
      <div className="card">
        <h3>Resultados Ágeis</h3>
        <p>Utilizamos tecnologia e estratégias jurídicas modernas para acelerar a resolução de conflitos, priorizando a eficiência e o seu bem-estar.</p>
      </div>
    </div>
  </main>
);

const Sobre = () => (
  <main className="main-content">
    <div className="contact-header" style={{textAlign: 'center', marginBottom: '2rem'}}>
      <h1>SOBRE NÓS</h1>
      <p>Gerar confiança e conexão humana.</p>
    </div>
    <div className="card" style={{maxWidth: '800px', margin: '0 auto'}}>
      <h3>Nosso Espaço</h3>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
         <img src="/images/fachada.jpg" alt="Fachada do Escritório 1300" style={{ width: '100%', maxWidth: '350px', borderRadius: '8px', objectFit: 'cover' }} />
         <img src="/images/recepcao.jpg" alt="Recepção do Escritório" style={{ width: '100%', maxWidth: '350px', borderRadius: '8px', objectFit: 'cover' }} />
      </div>
      <h3 style={{marginTop: '1.5rem'}}>O Escritório</h3>
      <p>Somos um escritório focado em entregar soluções jurídicas ágeis e eficientes nas áreas Trabalhista, Cível e Previdenciária.</p>
      <div style={{textAlign: 'center', marginTop: '2rem'}}>
        <button className="btn-send"><span>Conheça nossa Equipe</span></button>
      </div>
    </div>
  </main>
);

const Servicos = () => (
  <main className="main-content">
    <div className="contact-header" style={{textAlign: 'center', marginBottom: '4rem'}}>
      <h1 style={{fontSize: '3.5rem'}}>ÁREAS DE ATUAÇÃO</h1>
      <p>Soluções jurídicas precisas para os desafios do dia a dia.</p>
    </div>
    <div className="content-grid">
      <div className="card specialty-card">
        <div className="card-icon">⚖️</div>
        <h3>Direito do Trabalho</h3>
        <p>Defesa estratégica de direitos trabalhistas, reversão de justa causa, cálculos de horas extras, equiparação salarial e combate ao assédio moral no ambiente corporativo.</p>
      </div>
      <div className="card specialty-card">
        <div className="card-icon">📄</div>
        <h3>Direito Cível</h3>
        <p>Gestão de contratos, responsabilidade civil, direitos do consumidor, indenizações por danos morais e materiais, além de consultoria em direito sucessório e inventários.</p>
      </div>
      <div className="card specialty-card">
        <div className="card-icon">🏛️</div>
        <h3>Direito Previdenciário</h3>
        <p>Planejamento de aposentadoria, pedidos de benefícios ao INSS, revisões de aposentadoria (incluindo Vida Toda) e concessão de auxílio-doença e BPC/LOAS.</p>
      </div>
    </div>
    <div style={{textAlign: 'center', marginTop: '4rem'}}>
        <button className="btn-send"><span>Solicitar Análise de Caso</span></button>
    </div>
  </main>
);

const Portfolio = () => (
  <main className="main-content">
    <div className="contact-header" style={{textAlign: 'center', marginBottom: '2rem'}}>
      <h1>PORTFÓLIO / CASES</h1>
      <p>Comprovação social e resultados entregues.</p>
    </div>
    <div className="card" style={{maxWidth: '800px', margin: '0 auto'}}>
      <p><strong>Fotos e Vídeos:</strong> Imagens de alta qualidade dos produtos ou projetos que foram entregues no prazo.</p>
      <p style={{marginTop: '1rem'}}><strong>Histórias de Sucesso:</strong> A jornada do cliente: Qual problema tinha {'->'} Qual solução aplicamos {'->'} Qual foi o Resultado alcançado final.</p>
      <p style={{marginTop: '1rem'}}><strong>Depoimentos:</strong> Frases reais de clientes satisfeitos com foto e cargo (maior autoridade).</p>
      <div style={{textAlign: 'center', marginTop: '2rem'}}>
        <button className="btn-send"><span>Quero Resultados Assim</span></button>
      </div>
    </div>
  </main>
);

const Faq = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      q: "Quais documentos preciso para uma ação trabalhista?",
      a: "Geralmente são necessários: CTPS, termos de rescisão, extrato do FGTS, recibos de pagamento e qualquer prova documental (e-mails, mensagens, fotos) do ocorrido."
    },
    {
      q: "Como funciona a 'Revisão da Vida Toda'?",
      a: "É uma tese que permite incluir salários anteriores a 1994 no cálculo da aposentadoria. O processo está em julgamento no STF e requer análise técnica individual."
    },
    {
      q: "Quanto tempo demora um processo cível?",
      a: "O tempo varia conforme a complexidade e a comarca, mas trabalhamos com estratégias de conciliação para buscar resoluções mais rápidas sempre que possível."
    },
    {
      q: "Posso me aposentar por invalidez se tiver uma doença crônica?",
      a: "Sim, desde que a doença cause incapacidade total e permanente para o trabalho, comprovada por perícia médica e requisitos do INSS preenchidos."
    }
  ];

  return (
    <main className="main-content">
      <div className="contact-header" style={{textAlign: 'center', marginBottom: '3rem'}}>
        <h1>PERGUNTAS FREQUENTES</h1>
        <p>Esclareça suas principais dúvidas jurídicas de forma rápida.</p>
      </div>
      <div className="faq-container" style={{maxWidth: '800px', margin: '0 auto'}}>
        {faqs.map((item, index) => (
          <div key={index} className={`faq-item ${openIndex === index ? 'open' : ''}`} onClick={() => setOpenIndex(openIndex === index ? null : index)}>
            <div className="faq-question">
              <span>{item.q}</span>
              <span className="faq-icon">{openIndex === index ? '−' : '+'}</span>
            </div>
            {openIndex === index && <div className="faq-answer">{item.a}</div>}
          </div>
        ))}
      </div>
    </main>
  );
};

const Blog = ({ posts, onSelectPost }) => {
  return (
    <main className="main-content">
      <div className="contact-header" style={{textAlign: 'center', marginBottom: '3rem'}}>
        <h1>NOTÍCIAS & ARTIGOS</h1>
        <p>Mantenha-se informado sobre as mudanças no cenário jurídico brasileiro.</p>
      </div>
      <div className="blog-grid">
        {posts.map((item, index) => (
          <div key={index} className="card blog-card">
            {item.image && <img src={item.image} alt={item.title} className="blog-thumb" />}
            <span className="blog-date">{item.date}</span>
            <h3>{item.title}</h3>
            <p>{item.excerpt}</p>
            <button onClick={() => onSelectPost(item)} className="read-more" style={{background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'}}>
              Ler Artigo Completo →
            </button>
          </div>
        ))}
      </div>
    </main>
  );
};

// --- 4. PAGINA DE CONTATO ---
const Contact = () => (
  <main className="contact-page">
    <div className="contact-header">
      <h1>CONTATO</h1>
      <p>Entre em contato conosco.</p>
    </div>

    <div className="contact-layout">
      {/* Formulário */}
      <div className="contact-form-container">
        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>NOME:</label>
            <input type="text" placeholder="digite seu nome" />
          </div>
          <div className="form-group">
            <label>E-MAIL:</label>
            <input type="email" placeholder="digite seu e-mail" />
          </div>
          <div className="form-group">
            <label>TELEFONE:</label>
            <input type="tel" placeholder="digite seu telefone" />
          </div>
          <div className="form-group">
            <label>MENSAGEM:</label>
            <textarea placeholder="digite sua mensagem..." rows="8"></textarea>
          </div>
          <button type="submit" className="btn-send">
            <span>ENVIAR</span>
          </button>
        </form>
      </div>

      {/* Mapa e Localização */}
      <div className="contact-map-container">
        <p className="map-text">Se preferir, esta é a nossa localização. Faça-nos uma visita.</p>
        <div className="map-frame">
          <iframe 
            src="https://maps.google.com/maps?q=Av.%20Deputado%20Silvio%20Teixeira,%201300,%20Aracaju,%20SE&t=&z=15&ie=UTF8&iwloc=&output=embed" 
            width="100%" 
            height="400" 
            style={{ border: 0 }} 
            allowFullScreen="" 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade">
          </iframe>
        </div>
        <p className="address-text">Av. Deputado Silvio Teixeira, 1300, Sala 117, Centro Empresarial Carlos Cunha - (79) 99640-3775</p>
      </div>
    </div>
  </main>
);

// --- 5. PÁGINAS LEGAIS (Privacidade e Termos) ---
const LegalPages = ({ type }) => {
  const content = {
    privacy: {
      title: "POLÍTICA DE PRIVACIDADE",
      body: (
        <div className="legal-content">
          <p>A sua privacidade é importante para nós. É política do escritório Ademir Meira Advocacia respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar no site.</p>
          <h3>1. Coleta de Informações</h3>
          <p>Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço (como formulários de contato). Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento.</p>
          <h3>2. LGPD e Proteção de Dados</h3>
          <p>Em conformidade com a Lei Geral de Proteção de Dados (LGPD), garantimos que seus dados não serão compartilhados com terceiros sem autorização expressa, exceto por obrigatoriedade legal.</p>
          <h3>3. Sigilo Profissional</h3>
          <p>Todas as comunicações realizadas através deste portal estão protegidas pelo sigilo profissional inerente à advocacia, conforme o Estatuto da OAB.</p>
        </div>
      )
    },
    terms: {
      title: "TERMOS DE USO",
      body: (
        <div className="legal-content">
          <p>Ao acessar o site Ademir Meira Advocacia, você concorda em cumprir estes termos de serviço.</p>
          <h3>1. Uso do Conteúdo</h3>
          <p>O conteúdo deste site é meramente informativo e não constitui consulta jurídica formal. A contratação de serviços requer atendimento personalizado e contrato específico.</p>
          <h3>2. Propriedade Intelectual</h3>
          <p>Os artigos, logotipos e designs presentes neste site são de propriedade exclusiva do escritório ou de seus licenciantes, sendo proibida a reprodução sem autorização.</p>
          <h3>3. Limitação de Responsabilidade</h3>
          <p>O escritório não se responsabiliza por decisões tomadas com base exclusivamente nas informações contidas no blog, as quais podem sofrer alterações legislativas a qualquer momento.</p>
        </div>
      )
    }
  };

  return (
    <main className="main-content">
      <div className="contact-header" style={{textAlign: 'center', marginBottom: '3rem'}}>
        <h1>{content[type].title}</h1>
      </div>
      <div className="card legal-card" style={{maxWidth: '900px', margin: '0 auto'}}>
        {content[type].body}
      </div>
    </main>
  );
};

// --- 6. DETALHE DO POST E ADMIN ---
const PostDetail = ({ post, onBack }) => (
  <main className="main-content">
    <button className="btn-back" onClick={onBack}>← Voltar para o Blog</button>
    <article className="post-full">
      <div className="post-meta">
        <span className="blog-date">{post.date}</span>
      </div>
      <h1>{post.title}</h1>
      {post.image && <img src={post.image} alt={post.title} className="post-main-image" />}
      <div className="post-body">
        {post.content ? post.content.split('\n').map((p, i) => <p key={i}>{p}</p>) : <p>{post.excerpt}</p>}
      </div>
    </article>
  </main>
);

const AdminPanel = ({ onAddPost, onClose }) => {
  const [formData, setFormData] = React.useState({ title: '', date: '', excerpt: '', content: '', image: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return alert('Título e Conteúdo são obrigatórios');
    onAddPost({ ...formData, date: formData.date || new Date().toLocaleDateString('pt-BR') });
    alert('Artigo publicado com sucesso!');
    onClose();
  };

  return (
    <div className="admin-overlay">
      <div className="admin-modal card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
          <h2>Painel Administrativo</h2>
          <button className="theme-toggle" onClick={onClose}>Fechar</button>
        </div>
        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label>TÍTULO DO ARTIGO:</label>
            <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          </div>
          <div className="form-group">
            <label>RESUMO (EXCERPT):</label>
            <input type="text" value={formData.excerpt} onChange={e => setFormData({...formData, excerpt: e.target.value})} />
          </div>
          <div className="form-group">
            <label>URL DA IMAGEM:</label>
            <input type="text" placeholder="https://..." value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} />
          </div>
          <div className="form-group">
            <label>CONTEÚDO COMPLETO:</label>
            <textarea rows="10" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
          </div>
          <button type="submit" className="btn-send"><span>PUBLICAR ARTIGO</span></button>
        </form>
      </div>
    </div>
  );
};

// --- 8. EXTRAÇÃO DE PDF (Legal Tech) ---

const PdfExtractor = () => {
  return (
    <main className="main-content" style={{ textAlign: 'center', padding: '10rem 2rem' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>EM DESENVOLVIMENTO</h1>
      <p style={{ fontSize: '1.2rem', opacity: 0.7 }}>Esta funcionalidade está sendo aprimorada e estará disponível em breve.</p>
    </main>
  );
};

// --- 9. END BAR (Footer) ---
const Footer = ({ setActivePage }) => (
  <footer className="footer">
    <div className="footer-text">
      <p>&copy; 2024 Ademir Meira Advocacia. Todos os direitos reservados.</p>
    </div>
    <div className="footer-links">
      <a href="#privacy" onClick={(e) => { e.preventDefault(); setActivePage('privacy'); }}>Privacidade</a>
      <a href="#terms" onClick={(e) => { e.preventDefault(); setActivePage('terms'); }}>Termos de Uso</a>
      <a href="#admin" onClick={(e) => { e.preventDefault(); setActivePage('admin'); }} style={{opacity: 0.3}}>Gestão</a>
    </div>
  </footer>
);

export default function App() {
  const [theme, setTheme] = useState('light');
  const [activePage, setActivePage] = useState('home');
  const [selectedPost, setSelectedPost] = useState(null);

  // Inicializar posts do localStorage ou padrão
  const [posts, setPosts] = useState(() => {
    const saved = localStorage.getItem('blog_posts');
    return saved ? JSON.parse(saved) : [
      {
        date: "22 Abr 2024",
        title: "Vínculo de Emprego em Apps: O cenário atual no STF",
        excerpt: "Entenda como as decisões recentes sobre motoristas de aplicativos impactam os direitos trabalhistas no Brasil.",
        content: "A discussão sobre o vínculo empregatício entre motoristas e aplicativos como Uber e iFood chegou ao STF. As recentes decisões apontam para uma tendência de reconhecimento da autonomia, porém com ressalvas importantes sobre a subordinação algorítmica.\n\nPara o trabalhador, é essencial entender que cada caso possui particularidades que podem levar ao reconhecimento do vínculo se houver pessoalidade e subordinação direta.",
        image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=800"
      },
      {
        date: "20 Abr 2024",
        title: "Revisão da Vida Toda: Novos desdobramentos",
        excerpt: "O julgamento suspenso traz incertezas, mas especialistas recomendam manter as ações ativas. Saiba o porquê.",
        content: "A Revisão da Vida Toda é uma das teses mais esperadas pelos aposentados do INSS. Embora o julgamento tenha sofrido suspensões, a base jurídica permanece sólida para aqueles que contribuíram com valores altos antes de 1994.\n\nO planejamento previdenciário é a ferramenta chave para decidir se vale a pena ingressar com a ação agora.",
        image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800"
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('blog_posts', JSON.stringify(posts));
  }, [posts]);

  // Alternar entre temas
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const addPost = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="app-container">
      <Header setActivePage={setActivePage} />
      <Navbar 
        toggleTheme={toggleTheme} 
        theme={theme} 
        setActivePage={(page) => { setActivePage(page); setSelectedPost(null); }} 
        activePage={activePage} 
      />
      
      {/* Roteador Visual Simples */}
      {selectedPost ? (
        <PostDetail post={selectedPost} onBack={() => setSelectedPost(null)} />
      ) : (
        <>
          {activePage === 'home' && <Home setActivePage={setActivePage} />}
          {activePage === 'sobre' && <Sobre />}
          {activePage === 'servicos' && <Servicos />}
          {activePage === 'portfolio' && <Portfolio />}
          {activePage === 'faq' && <Faq />}
          {activePage === 'blog' && <Blog posts={posts} onSelectPost={setSelectedPost} />}
          {activePage === 'contact' && <Contact />}
          {activePage === 'privacy' && <LegalPages type="privacy" />}
          {activePage === 'terms' && <LegalPages type="terms" />}
          {activePage === 'admin' && <AdminPanel onAddPost={addPost} onClose={() => setActivePage('blog')} />}
          {activePage === 'extractor' && <PdfExtractor />}
        </>
      )}

      {/* Botão flutuante do WhatsApp */}
      <a href="https://wa.me/5579996403775" className="whatsapp-float" target="_blank" rel="noopener noreferrer" title="Fale no WhatsApp">
        💬
      </a>

      <Footer setActivePage={setActivePage} />
    </div>
  );
}

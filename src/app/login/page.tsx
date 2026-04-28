import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(49,139,255,0.22),_transparent_28%),linear-gradient(180deg,_#edf5ff_0%,_#f8fbff_48%,_#f5f8fc_100%)] px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[36px] bg-gradient-to-br from-[#1655b9] via-[#2976e8] to-[#79b6ff] p-8 text-white shadow-[0_24px_80px_rgba(17,80,170,0.28)]">
          <div className="flex items-center gap-3">
            <Image
              src="/branding/monex-mark.png"
              alt="Monex"
              width={56}
              height={56}
              className="h-14 w-14 rounded-2xl bg-white/10 object-contain p-1.5"
              priority
            />
            <Image
              src="/branding/monex-logo.png"
              alt="Monex"
              width={172}
              height={48}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>
          <p className="text-sm uppercase tracking-[0.28em] text-white/70">Acesso privado</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Login simples para entrar no Monex.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/82">
            Este fluxo foi pensado para uso individual, sem cadastro publico. A conta pode ser criada
            manualmente no Supabase e mantida com sessao persistente.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <FeatureCard title="Sessao longa" detail="menos atrito no dia a dia" />
            <FeatureCard title="Usuario unico" detail="dados isolados e privados" />
            <FeatureCard title="Pronto para Supabase" detail="Auth com cookies depois" />
          </div>
        </section>

        <section className="rounded-[36px] border border-white/70 bg-white/88 p-8 shadow-[0_24px_80px_rgba(17,34,68,0.08)] backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600">Entrar</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Continuar para o painel
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Nesta primeira versao, a tela ilustra o fluxo de autenticacao que sera ligado ao
              Supabase Auth.
            </p>
          </div>

          <form className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">E-mail</span>
              <input
                type="email"
                placeholder="voce@monex.local"
                className="field"
                defaultValue="caio@monex.local"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">Senha</span>
              <input type="password" placeholder="••••••••" className="field" defaultValue="12345678" />
            </label>

            <button
              type="button"
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Entrar
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-900">
            Cadastro publico desativado por design. Recuperacao de senha pode ser adicionada no mesmo
            fluxo quando a conexao com o Supabase estiver ativa.
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/14 bg-white/10 px-4 py-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-white/72">{detail}</p>
    </div>
  );
}

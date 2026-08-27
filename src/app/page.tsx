export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section>
        <p className="text-sm font-semibold tracking-[0.2em] text-orange-700 uppercase">
          Wildfire Tracker
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Project foundation is ready.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          The application, database tooling, validation, and test infrastructure
          are configured. Product features will be added in later milestones.
        </p>
      </section>
    </main>
  );
}

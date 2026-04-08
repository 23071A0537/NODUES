function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-base-300/80 bg-base-100/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="text-xs font-semibold tracking-wide text-base-content/75">
          NoDues Automation System
        </p>
        <p className="text-xs text-base-content/65">
          © {year} VNR Vignana Jyothi Institute of Engineering &amp; Technology
        </p>
      </div>
    </footer>
  );
}

export default Footer;

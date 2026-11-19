import "../styles/admin.css";

export default function AdminLayout({ title, subtitle, children }) {
  return (
    <main className="marketplace adm-page">
      <div className="adm-heading">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {children}
    </main>
  );
}

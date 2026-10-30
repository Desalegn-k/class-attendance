import "./Footer.css";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span className="footer-brand">Class Attendance</span>

        <nav className="footer-links">
          <a href="/">Home</a>
          
          
        </nav>

        <span className="footer-copy">
          © {new Date().getFullYear()} Class Attendance. All rights reserved.
        </span>
      </div>
    </footer>
  );
}

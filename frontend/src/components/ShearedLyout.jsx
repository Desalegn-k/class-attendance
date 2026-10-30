import { Outlet } from "react-router-dom";
import MainHeader from "./MainHeader";
import Fottor from "./Fottor";

export default function ShearedLyout() {
  return (
    <div className="app-shell">
      <a className="sr-only" href="#main-content">
        Skip to main content
      </a>
      <MainHeader />
      <main className="app-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <Fottor />
    </div>
  );
}

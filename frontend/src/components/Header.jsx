/**
 * Page-level header: title, optional subtitle and page actions.
 * User name and log out live only in MainHeader.
 */
export default function Header({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>

      {children && <div className="page-header__actions">{children}</div>}
    </div>
  );
}

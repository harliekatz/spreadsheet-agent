"use client";

import {
  Clock,
  FileText,
  Folder,
  PanelLeft,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Brand } from "./Brand";

export type SidebarProps = {
  view: string;
  deletedCount: number;
  folders: string[];
  navigate: (view: string) => void;
  newSheet: () => void;
  addFolder: () => void;
  busy: boolean;
  collapsed: boolean;
  toggle: () => void;
};

const PRIMARY: [typeof FileText, string][] = [
  [FileText, "All Sheets"],
  [Clock, "Recent"],
  [Star, "Starred"],
  [Users, "Shared with me"],
];

export function Sidebar({
  view,
  deletedCount,
  folders,
  navigate,
  newSheet,
  addFolder,
  busy,
  collapsed,
  toggle,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar ${collapsed ? "is-rail" : ""}`}
      aria-label="Workspace navigation"
    >
      <div className="sidebar-head">
        {collapsed ? (
          <Brand size={22} />
        ) : (
          <span className="wordmark">
            <Brand size={22} />
            Spreadsheet Agent
          </span>
        )}
        <button
          type="button"
          className="icon-button tip"
          data-tip={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          onClick={toggle}
        >
          <PanelLeft size={17} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Sheets">
        {/* The single, persistent place to start a sheet. */}
        <button
          type="button"
          disabled={busy}
          className={`nav-item is-primary ${collapsed ? "tip" : ""}`}
          data-tip="New sheet"
          aria-label="New sheet"
          onClick={newSheet}
        >
          <Plus aria-hidden="true" />
          {!collapsed && "New sheet"}
        </button>

        {PRIMARY.map(([Icon, label]) => (
          <button
            key={label}
            type="button"
            disabled={busy}
            className={`nav-item ${view === label ? "is-active" : ""} ${collapsed ? "tip" : ""}`}
            data-tip={label}
            aria-label={label}
            aria-current={view === label ? "page" : undefined}
            onClick={() => navigate(label)}
          >
            <Icon aria-hidden="true" />
            {!collapsed && label}
          </button>
        ))}

        {!collapsed && (
          <>
            <div className="nav-group-label">
              <span className="eyebrow" id="folder-heading">
                Folders
              </span>
              <button
                type="button"
                className="tip"
                data-tip="New folder"
                aria-label="Create a folder"
                onClick={addFolder}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
            <div role="group" aria-labelledby="folder-heading">
              {folders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  disabled={busy}
                  className={`nav-item ${view === folder ? "is-active" : ""}`}
                  aria-current={view === folder ? "page" : undefined}
                  onClick={() => navigate(folder)}
                >
                  <Folder aria-hidden="true" />
                  {folder}
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="sidebar-bottom">
        <button
          type="button"
          disabled={busy}
          className={`nav-item ${view === "Recently deleted" ? "is-active" : ""} ${
            collapsed ? "tip" : ""
          }`}
          data-tip="Recently deleted"
          aria-label="Recently deleted"
          aria-current={view === "Recently deleted" ? "page" : undefined}
          onClick={() => navigate("Recently deleted")}
        >
          <Trash2 aria-hidden="true" />
          {!collapsed && (
            <>
              Recently deleted
              {deletedCount > 0 && <span className="nav-count">{deletedCount}</span>}
            </>
          )}
        </button>

        {!collapsed && (
          <p className="sidebar-foot">
            Portfolio demo. All data is synthetic and generated locally.
          </p>
        )}
      </div>
    </aside>
  );
}

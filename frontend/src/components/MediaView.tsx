import { LogOut } from "lucide-react";
import { UserContext } from "../types";
import TitlesView from "./TitlesView";
import { memo } from "react";

interface Props {
  userCtx: UserContext;
  onLogout?: () => void;
  onBackToLogin?: () => void;
}

const MemoTitlesView = memo(TitlesView, (prev, next) => 
  prev.userCtx.role === next.userCtx.role &&
  prev.userCtx.email === next.userCtx.email
);

export default function MediaView({ userCtx, onLogout, onBackToLogin }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h2 className="text-gray-900 font-semibold">Inventar Media</h2>
            <div className="flex items-center gap-3">
              {userCtx.email && (
                <span className="hidden sm:block text-sm text-gray-500">
                  {userCtx.email}
                </span>
              )}
              {userCtx.role === "guest" && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                  Guest
                </span>
              )}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
              {!onLogout && userCtx.role === "guest" && (
                <button
                  onClick={onBackToLogin}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to Login"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex justify-center p-4 sm:p-8">
        <MemoTitlesView userCtx={userCtx} />
      </div>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-gray-400 border-t border-gray-100 bg-white">
        <span>© {new Date().getFullYear()} Snyuki</span>
        <span className="mx-2">·</span>
        <span>v{__APP_VERSION__}</span>
      </footer>
    </div>
  );
}
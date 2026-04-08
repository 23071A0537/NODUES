import { ChevronDown, Mail, Shield, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface UserProfileDropdownProps {
  username: string;
  email: string;
  role: string;
}

const UserProfileDropdown = ({
  username,
  email,
  role,
}: UserProfileDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initials =
    username
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-base-300 bg-base-100 pl-1.5 pr-2 py-1 shadow-sm transition-colors hover:bg-base-200"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open profile menu"
      >
        <div className="h-8 w-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold leading-tight text-base-content">
            {username}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-base-content/65">
            {role}
          </p>
        </div>
        <ChevronDown size={14} className="text-base-content/60" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 official-surface-plain shadow-xl z-[9997]"
          role="menu"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 border-b border-base-300 pb-3">
              <div className="h-11 w-11 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold">
                {initials}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base">{username}</p>
                <p className="text-xs text-base-content/60 capitalize tracking-wide">
                  {role} account
                </p>
              </div>
              <span className="official-chip">Secure</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-base-200/80">
                <User size={18} className="mt-0.5 text-base-content/70" />
                <div>
                  <p className="text-xs text-base-content/60">Username</p>
                  <p className="text-sm font-medium">{username}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-base-200/80">
                <Mail size={18} className="mt-0.5 text-base-content/70" />
                <div>
                  <p className="text-xs text-base-content/60">Email</p>
                  <p className="text-sm font-medium break-all">{email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-base-200/80">
                <Shield size={18} className="mt-0.5 text-base-content/70" />
                <div>
                  <p className="text-xs text-base-content/60">Role & Access</p>
                  <p className="text-sm font-medium capitalize tracking-wide">
                    {role}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;

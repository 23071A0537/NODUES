import logo1 from "../assets/logo1.png";
import ThemeSelector from "./ThemeSelector";

function Header() {
  return (
    <header className="w-full border-b border-base-300/80 bg-base-100/90 shadow-sm backdrop-blur-md transition-colors duration-300">
      <div className="institutional-backdrop">
        <div className="mx-auto flex h-[5.5rem] max-w-[1600px] items-center gap-3 px-3 sm:px-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <img
              src={logo1}
              alt="VNR Vignana Jyothi Institute of Engineering and Technology"
              className="h-9 sm:h-11 md:h-14 lg:h-16 w-auto max-w-full object-contain"
            />
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="official-chip">Student Services</span>
            <span className="official-chip">Faculty Services</span>
          </div>

          <div className="flex-shrink-0">
            <ThemeSelector />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

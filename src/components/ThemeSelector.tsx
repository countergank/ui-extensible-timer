import { Button } from "@/components/ui/button";
import { FaMoon, FaSun } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";

const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button type="button" onClick={toggleTheme}>
      {theme === "dark" ? <FaSun /> : <FaMoon />}
    </Button>
  );
};

export default ThemeSelector;

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 相对路径：GitHub Pages 部署在 /xiantu/ 子路径下，资源引用不依赖绝对域名
  base: "./",
  plugins: [react()],
});

// vite.config.js
import { defineConfig } from "file:///sessions/confident-nice-pasteur/mnt/%D7%A2%D7%91%D7%95%D7%93%D7%95%D7%AA%20%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98--dira-management/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/confident-nice-pasteur/mnt/%D7%A2%D7%91%D7%95%D7%93%D7%95%D7%AA%20%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98--dira-management/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvY29uZmlkZW50LW5pY2UtcGFzdGV1ci9tbnQvXHUwNUUyXHUwNUQxXHUwNUQ1XHUwNUQzXHUwNUQ1XHUwNUVBIFx1MDVEMFx1MDVEOVx1MDVFMFx1MDVEOFx1MDVFOFx1MDVFMFx1MDVEOC0tZGlyYS1tYW5hZ2VtZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvY29uZmlkZW50LW5pY2UtcGFzdGV1ci9tbnQvXHUwNUUyXHUwNUQxXHUwNUQ1XHUwNUQzXHUwNUQ1XHUwNUVBIFx1MDVEMFx1MDVEOVx1MDVFMFx1MDVEOFx1MDVFOFx1MDVFMFx1MDVEOC0tZGlyYS1tYW5hZ2VtZW50L3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9jb25maWRlbnQtbmljZS1wYXN0ZXVyL21udC8lRDclQTIlRDclOTElRDclOTUlRDclOTMlRDclOTUlRDclQUElMjAlRDclOTAlRDclOTklRDclQTAlRDclOTglRDclQTglRDclQTAlRDclOTgtLWRpcmEtbWFuYWdlbWVudC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBvcGVuOiB0cnVlXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDYwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgJ3ZlbmRvci1yZWFjdCc6ICAgIFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgICAgICAgICAndmVuZG9yLXN1cGFiYXNlJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaWMsU0FBUyxvQkFBb0I7QUFDOWQsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osZ0JBQW1CLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQzVELG1CQUFtQixDQUFDLHVCQUF1QjtBQUFBLFFBQzdDO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

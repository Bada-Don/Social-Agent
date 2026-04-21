/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack configuration to point to the correct workspace root
  turbopack: {
    root: "../../",
  },
};

export default nextConfig;

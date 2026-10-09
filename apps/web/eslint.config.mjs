import { nextConfig } from "@fine-leads/config/eslint/next";

export default [...nextConfig, { ignores: ["public/**"] }];

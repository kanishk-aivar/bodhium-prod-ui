const nextConfig = {
  env: {
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    RDS_HOST: process.env.RDS_HOST,
    RDS_PORT: process.env.RDS_PORT,
    RDS_DATABASE: process.env.RDS_DATABASE,
    RDS_USERNAME: process.env.RDS_USERNAME,
    RDS_PASSWORD: process.env.RDS_PASSWORD,
    LAMBDA_WEBSCRAPPER_ARN: process.env.LAMBDA_WEBSCRAPPER_ARN,
    LAMBDA_QUERY_GENERATOR_ARN: process.env.LAMBDA_QUERY_GENERATOR_ARN,
    LAMBDA_LLM_ORCHESTRATOR_ARN: process.env.LAMBDA_LLM_ORCHESTRATOR_ARN,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['placeholder.svg'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
  // Force Node.js runtime for API routes
  experimental: {
    runtime: 'nodejs',
  },
}

export default nextConfig

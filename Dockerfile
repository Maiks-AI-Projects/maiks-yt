FROM node:22-alpine

WORKDIR /app

# Install libc6-compat for Next.js
RUN apk add --no-cache libc6-compat

# Set environment to development
ENV NODE_ENV=development
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Expose port 3000
EXPOSE 3000

# We don't copy files here because we'll mount them via volume in docker-compose
# for live reloading as requested.
# However, we can ensure npm run dev is the default command.
CMD ["npm", "run", "dev"]

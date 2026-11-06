FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Next.js bakes NEXT_PUBLIC_* values into the browser code when it builds, so this has to be
# known at build time (docker-compose.yml passes it). It is the address your browser uses.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]

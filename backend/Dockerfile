FROM denoland/deno:2.3.5

WORKDIR /app

# Cache the dependencies
COPY deno.json .
COPY deno.lock* .
RUN deno cache --lock=deno.lock src/server.ts

# Copy the rest of the application
COPY . .

# Compile the application
RUN deno compile --allow-net --allow-env --allow-read --allow-run --allow-sys --allow-import --unstable-kv --no-check --output /app/server src/server.ts

# Run the application
CMD ["/app/server"] 
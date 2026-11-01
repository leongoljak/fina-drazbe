FROM ruby:3.2-alpine

WORKDIR /app

# Install basic tools and webrick (removed from Ruby 3+ stdlib)
RUN apk add --no-cache tzdata ca-certificates && gem install webrick

# Copy files
COPY . /app

ENV PORT=3000
EXPOSE 3000

CMD ["ruby", "server.rb"]

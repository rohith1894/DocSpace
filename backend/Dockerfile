# Multi-stage build for DocSpace Spring Boot backend
# Stage 1: Build artifact with Maven
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Lightweight runtime image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENV PORT=8080
# Restrict JVM max heap to 400MB to stay within Render 512MB free tier limit
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-Xmx400m", "-jar", "app.jar"]

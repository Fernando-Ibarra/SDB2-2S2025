import time
import random
import uuid
from locust import HttpUser, task, between
from faker import Faker

fake = Faker()

class MovieUser(HttpUser):
    # Se ejecuta cada 5 segundos
    wait_time = between(5, 5)

    @task
    def create_movie(self):
        # Genera datos dinámicos
        body = {
            "title": fake.sentence(nb_words=3),  # título aleatorio
            "description": fake.text(max_nb_chars=80),  # descripción aleatoria
            "release_year": random.randint(1980, 2025),  # año aleatorio
        }

        with self.client.post(
            "/api/v1/movie",
            json=body,
            name="/api/v1/movie[create]",
            catch_response=True,
        ) as response:
            if response.status_code != 201:
                response.failure(f"Error {response.status_code}: {response.text}")
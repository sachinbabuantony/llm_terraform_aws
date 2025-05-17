FROM ubuntu

# Install Python and pip
RUN apt update && apt install -y python3 python3-pip

# Copy app source code
COPY backend /backend
COPY frontend /frontend

# Install Python packages with override
RUN pip3 install --break-system-packages -r /backend/requirements.txt

# Set working directory (optional but cleaner)
WORKDIR /backend
EXPOSE 8080
# Run the backend app
CMD ["python3", "app.py"]


import os
import io
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from google import genai
from google.genai import types
from PIL import Image
import uvicorn

app = FastAPI()

# Enable CORS so your GitHub Pages site can securely communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace with your exact GitHub Pages URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the modern Google GenAI Client
# Hugging Face automatically exposes your Secret to os.environ
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

@app.get("/")
def home():
    return {"status": "Nano Banana API Backend Running"}

@app.post("/remix-face")
async def remix_face(
    face_image: UploadFile = File(...),
    reference_image: UploadFile = File(...)
):
    try:
        # Read the raw uploaded bytes from the frontend
        face_bytes = await face_image.read()
        reference_bytes = await reference_image.read()
        
        # Open bytes as PIL images for Google SDK compatibility
        pil_face = Image.open(io.BytesIO(face_bytes))
        pil_reference = Image.open(io.BytesIO(reference_bytes))
        
        # Formulate the multi-image composition prompt for Nano Banana
        prompt = (
            "Analyze the two provided images: the first image is a person's face, "
            "and the second image is a 3D Asaro head render showing desired lighting and angle. "
            "Generate a new output image that preserves 100% of the facial features, identity, and skin textures from the "
            "first image, but entirely remixes its physical orientation, yaw, pitch, and directional shadow casting "
            "to mimic the exact 3D angle and lighting of the Asaro head reference."
        )
        
        # Execute the multi-image generation call to Nano Banana (Gemini 2.5 Flash Image)
        # Pass both images inside the contents array along with the string instructions
        response = client.models.generate_content(
            model='gemini-2.5-flash-image',
            contents=[
                pil_face,
                pil_reference,
                prompt
            ]
        )
        
        # Extract the resulting image asset bytes
        generated_image_bytes = response.candidates[0].content.parts[0].inline_data.data
        
        return Response(content=generated_image_bytes, media_type="image/jpeg")
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Hugging Face requires your custom Python script to run specifically on port 7860
    uvicorn.run(app, host="0.0.0.0", port=7860)

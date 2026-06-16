import os
import io
from typing import List
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
    face_images: List[UploadFile] = File(...),
    reference_image: UploadFile = File(...)
):
    try:
        # Process the list of face images
        pil_faces = []
        for face_img in face_images:
            face_bytes = await face_img.read()
            pil_faces.append(Image.open(io.BytesIO(face_bytes)))
            
        # Process the single reference image
        reference_bytes = await reference_image.read()
        pil_reference = Image.open(io.BytesIO(reference_bytes))
        
        # Formulate the multi-image composition prompt
        prompt = (
            f"You are an expert lighting and 3D artist. You have {len(pil_faces) + 1} input images:\n"
            f"The first {len(pil_faces)} image(s) show the Subject: A person's face from various angles.\n"
            "The final image is the Pose & Lighting Reference: A grayscale 3D render of an Asaro head.\n\n"
            "TASK: Generate a new portrait of the Subject. You MUST change the subject's head angle "
            "to match the Pose Reference. You MUST apply the exact shadow patterns from the Pose Reference. "
            "Use the multiple photos of the subject to preserve 100% of their identity and facial features. "
            "Do not just copy the original Subject images; you must rotate their head and change "
            "the lighting to match the Asaro head perfectly."
        )
        
        # Execute the multi-image generation call
        contents = pil_faces + [pil_reference, prompt]
        response = client.models.generate_content(
            model='gemini-2.5-flash-image',
            contents=contents
        )
        
        # Extract the resulting image asset bytes
        generated_image_bytes = response.candidates[0].content.parts[0].inline_data.data
        
        return Response(content=generated_image_bytes, media_type="image/jpeg")
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Hugging Face requires your custom Python script to run specifically on port 7860
    uvicorn.run(app, host="0.0.0.0", port=7860)

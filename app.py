import os
import tempfile
import requests
from flask import Flask, request, jsonify, render_template
from urllib.parse import urlparse
import time
from flask_executor import Executor

app = Flask(__name__)

executor = Executor(app)

API_KEY = os.getenv('API_KEY')
if API_KEY is None:
    raise ValueError("No API_KEY set for Flask application")

def analyze_file(file_path):
    # Funcție pentru analizarea unui fișier prin intermediul API-ului VirusTotal
    url = 'https://www.virustotal.com/api/v3/files'
    headers = {
        'x-apikey': API_KEY
    }

    with open(file_path, 'rb') as f:
        files = {
            'file': f
        }
        while True:
            response = requests.post(url, headers=headers, files=files)

            if response.status_code == 200:
                return response.json()
            
            elif response.status_code == 429:
                print("Limită de rată depășită. Se așteaptă 60 de secunde...")
                time.sleep(60)  # se așteaptă 60 de secunde înainte de a reîncerca
                continue
            elif response.status_code != 200:
                raise Exception(f'Eroare API VirusTotal: {response.status_code}, Răspuns: {response.content}')

def get_analysis_result(analysis_id):
    # Funcție pentru obținerea rezultatelor unei analize prin intermediul API-ului VirusTotal
    url = f'https://www.virustotal.com/api/v3/analyses/{analysis_id}'
    headers = {
        'x-apikey': API_KEY
    }

    while True:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            print("Limită de rată depășită. Se așteaptă 60 de secunde...")
            time.sleep(60)  # se așteaptă 60 de secunde înainte de a reîncerca
            continue
        elif response.status_code != 200:
            raise Exception(f'Eroare API VirusTotal: {response.status_code}, Răspuns: {response.content}')

def is_valid_url(url):
    # Funcție pentru verificarea validității unui URL
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False


@app.route('/')
def index():
    # Rutează către șablonul index.html pentru pagina principală
    return render_template('index.html')

@app.route('/info')
def info():
    # Rutează către șablonul informations.html pentru pagina de informații
    return render_template('informations.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    # Rutează cererea POST pentru analizarea fișierului sau URL-ului
    file = request.files.get('file')
    url = request.form.get('url')

    if not file and not url:
        return jsonify({'error': 'Nu s-a furnizat niciun fișier sau URL'}), 400

    if url and not is_valid_url(url):
        return jsonify({'error': 'URL invalid furnizat'}), 400

    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        if file:
            file_size = len(file.read())
            # API-ul VirusTotal are o limită de dimensiune a fișierului de 32 MB pentru nivelul gratuit
            if file_size > 32 * 1024 * 1024:
                return jsonify({'error': 'Dimensiunea fișierului depășește limita de 32 MB'}), 400
            file.seek(0)  # resetează poziția pointerului fișierului la început
            file.save(temp_file)
        else:
            response = requests.get(str(url))
            if response.status_code != 200:
                return jsonify({'error': f'Imposibil de descărcat fișierul de la URL-ul: {url}'}), 400
            temp_file.write(response.content)

        temp_file.flush()

        try:
            submission_result = analyze_file(temp_file.name)
            analysis_id = submission_result["data"]["id"]
            return jsonify({'data': {'id': analysis_id}})

        except Exception as e:
            # se face distincție între eroarea API (500) și eroarea de validare (400)
            if 'Invalid' in str(e):
                return jsonify({'error': str(e)}), 400
            else:
                return jsonify({'error': str(e)}), 500

        finally:
            temp_file.close()
            os.unlink(temp_file.name)

@app.route('/analysis/<analysis_id>', methods=['GET'])
def analysis(analysis_id):
    # Rutează cererea GET pentru obținerea rezultatelor analizei
    try:
        analysis_result = get_analysis_result(analysis_id)
        return jsonify(analysis_result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

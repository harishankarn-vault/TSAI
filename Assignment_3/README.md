# Animal Picker & File Uploader (Flask)

A minimal Flask app with a frontend that:
- Lets you pick one of three animals (cat, dog, elephant) and shows a local image
- Lets you upload any file and returns its name, size (bytes), and type via the Flask backend

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Then open `http://127.0.0.1:5001`.

## Project structure

```
assignment-2/
  app.py
  wsgi.py
  requirements.txt
  Procfile
  templates/
    index.html
  static/
    css/styles.css
    js/main.js
    images/{cat.jpg, dog.jpg, elephant.jpg}
```

Note: Images are placeholders here; replace files under `static/images/` with real JPGs if needed.

## API

- `POST /upload` multipart form with `file`
  - Response JSON: `{ name, size_bytes, type }`

## Deploy to AWS

### Option 1: AWS Elastic Beanstalk (Recommended)

1. **Install AWS CLI and EB CLI:**
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /
   
   # Install EB CLI (recommended: use virtual environment)
   python3 -m venv .venv
   source .venv/bin/activate
   pip install awsebcli
   ```

2. **Configure AWS credentials:**
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, region (e.g., us-east-1)
   ```

3. **Deploy to Elastic Beanstalk:**
   ```bash
   cd /Users/harishankar/Documents/gitClone/TSAI/Assignment_2
   eb init --platform python-3.12 --region us-east-1
   eb create animal-picker-env
   eb deploy
   ```

4. **Get your URL:**
   ```bash
   eb status
   # Copy the CNAME URL and test it
   ```

### Option 2: AWS EC2 (Alternative)

1. **Launch EC2 instance:**
   - Use Amazon Linux 2 or Ubuntu
   - Security Group: Allow HTTP (port 80) and SSH (port 22)

2. **Connect and setup:**
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   
   # Install Python and dependencies
   sudo yum update -y
   sudo yum install python3 python3-pip -y
   
   # Upload your code (or git clone)
   cd /home/ec2-user
   # Upload your project files here
   
   # Install requirements
   pip3 install -r requirements.txt
   
   # Run with gunicorn
   gunicorn -w 2 -b 0.0.0.0:80 wsgi:application
   ```

3. **Access your app:**
   - Open `http://your-instance-ip` in browser

## Links to provide with submission

- YouTube demo video: <https://www.youtube.com/watch?v=a43b-XSx9LI&feature=youtu.be>
- GitHub repository: <https://github.com/harishankarn-vault/TSAI>
- AWS live URL: <paste link here> (it can be shut down after 1 hour)

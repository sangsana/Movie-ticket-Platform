pipeline {
    agent any

    stages {
        stage('Code Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/sangsana/Movie-ticket-Platform.git'
            }
        }
        stage('Sonar Code Analysis'){
            steps{
                script{
                    def scannerHome = tool 'sonar';
                    withSonarQubeEnv('sonar') {
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }    
            }    
        }
        stage('Image Build'){
            steps{
                sh 'docker build -t sangsana/movieapp:frontend frontend'
                sh 'docker build -t sangsana/movieapp:backend backend'
            }
        }
        stage('Trivy Scan') {
            steps {
                sh  '''
                    mkdir -p $WORKSPACE/trivy-reports
                    trivy image --format table -o $WORKSPACE/trivy-reports/frontend.txt sangsana/movieapp:frontend
                    trivy image --format table -o $WORKSPACE/trivy-reports/backend.txt sangsana/movieapp:backend
                    '''
                archiveArtifacts artifacts: 'trivy-reports/*.txt', fingerprint: true
                publishHTML(target: [
                    reportDir: 'trivy-reports',
                    reportFiles: 'frontend.txt,backend.txt',
                    reportName: 'Trivy Vulnerability Report'
                ])
            }
        }
        stage('Approval Gate'){
            steps{
                script{
                    input message: 'Approve Push to DockerHub',
                          ok: 'Push',
                          submitter: 'bollu,sangsana',
                          timeout: 1,unit:'HOURS'
                }    
            }
        }
        stage('Push to Image Registry'){
            steps{
                script{
                    withDockerRegistry(credentialsId: 'DockerHub Creds') {
                        sh 'docker push sangsana/movieapp:frontend'
                        sh 'docker push sangsana/movieapp:backend'
                    }        
                }
            }
        }
    }
}

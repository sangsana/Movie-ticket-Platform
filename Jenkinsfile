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
                sh 'docker build -t sangsana/movieapp-frontend:${BUILD_NUMBER} frontend'
                sh 'docker build -t sangsana/movieapp-backend:${BUILD_NUMBER} backend'
            }
        }
        stage('Trivy Scan') {
            steps {
                sh  '''
                    mkdir -p $WORKSPACE/trivy-reports
                    trivy image --format table -o $WORKSPACE/trivy-reports/frontend.txt sangsana/movieapp-frontend:${BUILD_NUMBER}
                    trivy image --format table -o $WORKSPACE/trivy-reports/backend.txt sangsana/movieapp-backend:${BUILD_NUMBER}
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
                        sh 'docker push sangsana/movieapp-frontend:${BUILD_NUMBER}'
                        sh 'docker push sangsana/movieapp-backend:${BUILD_NUMBER}'
                    }        
                }
            }
        }
        stage('Update K8s Manifest') {
            steps {
                dir('gitops') {
                    git branch: 'main',
                        credentialsId: 'GitHub Creds',
                        url: 'https://github.com/sangsana/Movie-ticket-Platform-k8s.git'

                    dir('manifests') {
                        sh '''
                            set -e

                            sed -i '/name: sangsana\\/movieapp-frontend/{n;s/newTag:.*/newTag: '"${BUILD_NUMBER}"'/;}' kustomization.yaml

                            sed -i '/name: sangsana\\/movieapp-backend/{n;s/newTag:.*/newTag: '"${BUILD_NUMBER}"'/;}' kustomization.yaml

                            echo "Updated image tags:"
                            cat kustomization.yaml

                            git config user.name "Jenkins"
                            git config user.email "jenkins@example.com"

                            git add kustomization.yaml

                            if ! git diff --cached --quiet; then
                                git commit -m "Update image tags to build ${BUILD_NUMBER}"
                                git push origin HEAD:main
                            else
                                echo "No changes to commit."
                            fi
                        '''
                    }
                }
            }
        }
    }
}

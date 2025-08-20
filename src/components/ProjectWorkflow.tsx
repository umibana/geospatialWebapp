import React, { useState } from 'react';
import ProjectManager from './ProjectManager';
import EnhancedCsvProcessor from './EnhancedCsvProcessor';

interface ProjectWorkflowState {
  view: 'projects' | 'csv-processor';
  processingFileId?: string;
  processingFileName?: string;
}

const ProjectWorkflow: React.FC = () => {
  const [workflowState, setWorkflowState] = useState<ProjectWorkflowState>({
    view: 'projects'
  });

  const handleFileUploadComplete = (fileId: string, fileName: string) => {
    // After file upload, switch to CSV processor for column configuration
    setWorkflowState({
      view: 'csv-processor',
      processingFileId: fileId,
      processingFileName: fileName
    });
  };

  const handleProcessingComplete = (datasetId: string) => {
    console.log('Dataset processing complete:', datasetId);
    // Return to project view after processing
    setWorkflowState({ view: 'projects' });
  };

  const handleCancelProcessing = () => {
    // Return to project view if user cancels
    setWorkflowState({ view: 'projects' });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {workflowState.view === 'projects' && (
        <ProjectManager 
          onFileUploadComplete={handleFileUploadComplete}
        />
      )}
      
      {workflowState.view === 'csv-processor' && workflowState.processingFileId && (
        <EnhancedCsvProcessor
          fileId={workflowState.processingFileId}
          fileName={workflowState.processingFileName || 'Unknown File'}
          onProcessingComplete={handleProcessingComplete}
          onCancel={handleCancelProcessing}
        />
      )}
    </div>
  );
};

export default ProjectWorkflow;
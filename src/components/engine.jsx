import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls, TransformControls } from '@react-three/drei';
import { useRef, useState, useEffect } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as THREE from 'three';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import OpenAI from "openai";


// Initialize OpenAI client
const openai = new OpenAI({
  baseURL: "https://ejs44fyotzsjtt7x.us-east-1.aws.endpoints.huggingface.cloud/v1/",
  apiKey: "hf_XXXXX",
  dangerouslyAllowBrowser: true  // Enable browser usage
});

// AI Personality prompt for script generation
const AI_PERSONALITY = `You are an expert game engine scripting assistant for a Three.js-based Electron game engine. You generate JavaScript scripts in a format that integrates seamlessly with the engine. Your scripts either update a model (NPC, player, or other entities) or update the scene (camera, physics, save system, etc.). Always follow these rules:

Structure & Parameters:

The script must be a function named update, with the following parameters:

model (for model scripts) or scene (for scene scripts)

THREE (Three.js library)

getModelByName, getAnimationsForModel, playAnimation, stopAnimation (utility functions for model handling)

createHTML, removeHTML (for UI updates)

input (keyboard and mouse inputs)

delta (time step for smooth movement)

camera (camera object, if needed)

Model Scripts:

Handle movement, animations, combat, AI, or interaction logic for specific entities.

Include movement with WASD or NPC following logic when necessary.

Always play appropriate animations (idle, walk, run, attack, etc.).

Ensure objects are initialized properly inside if (!model.userData.initialized) { ... }.

Scene Scripts:

Handle camera movement, physics, world interactions, saving/loading, or global game mechanics.

Use scene.userData for persistent variables.

Manage physics, collisions, or global events in a structured way.

Code Style:

Keep code optimized and readable.

Use normalize() for movement vectors.

Include comments for clarity.

Follow game engine conventions.

Generate only the JavaScript code without additional explanations
`;

// Default script templates
const DEFAULT_MODEL_SCRIPT = `// Model Script
// Available variables and utilities:
// - model: The current model object (THREE.Object3D)
// - scene: The scene object (THREE.Scene)
// - THREE: The Three.js library
// - getModelByName(name): Function to get other models by name
// - getAnimationsForModel(modelName): Function to get animations for a model
// - playAnimation(modelName, animationName): Function to play an animation
// - stopAnimation(modelName): Function to stop all animations for a model
// - createHTML(html): Function to create and add HTML elements to the overlay
// - removeHTML(id): Function to remove HTML elements from the overlay
// - input: Input state object (keys, mouse)
// - delta: Time since last frame

function update(model, scene, THREE, getModelByName, getAnimationsForModel, playAnimation, stopAnimation, createHTML, removeHTML, input, delta) {
  // Play idle animation when W is pressed, stop when released
  if (input.keys.w) {
    playAnimation(model.name, 'idle');
  } else {
    stopAnimation(model.name);
  }

  // Optional: Move the model when animating
  if (input.keys.w) {
    model.position.z -= delta * 5; // Move forward while animating
  }
}

return { update };`;

const DEFAULT_SCENE_SCRIPT = `// Scene Script
// Available variables and utilities:
// - scene: The scene object (THREE.Scene)
// - THREE: The Three.js library
// - getModelByName(name): Function to get models by name
// - getAnimationsForModel(modelName): Function to get animations for a model
// - playAnimation(modelName, animationName): Function to play an animation
// - stopAnimation(modelName): Function to stop all animations for a model
// - createHTML(html): Function to create and add HTML elements to the overlay
// - removeHTML(id): Function to remove HTML elements from the overlay
// - input: Input state object (keys, mouse)
// - delta: Time since last frame

function update(scene, THREE, getModelByName, getAnimationsForModel, playAnimation, stopAnimation, createHTML, removeHTML, input, delta) {
  // Example: Create a game UI
  createHTML(\`
    <div id="gameUI" style="
      position: absolute;
      top: 10px;
      left: 10px;
      color: white;
      font-family: Arial;
    ">
      <h2>Game Status</h2>
      <p>Press SPACE to start</p>
    </div>
  \`);

  // Example: Make enemies chase the player
  const player = getModelByName('player.glb');
  const enemy = getModelByName('enemy.glb');
  
  if (player && enemy) {
    // Get the direction to the player
    const direction = new THREE.Vector3()
      .subVectors(player.position, enemy.position)
      .normalize();
    
    // Move enemy towards player
    enemy.position.x += direction.x * 2 * delta;
    enemy.position.z += direction.z * 2 * delta;
    
    // Calculate distance to player
    const distance = player.position.distanceTo(enemy.position);
    
    // Play appropriate animation based on distance
    if (distance < 2) {
      // Attack when close
      playAnimation('enemy.glb', 'attack');
      
      // Create attack UI notification
      createHTML(\`
        <div id="attackNotice" style="
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(255, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          font-family: Arial;
          pointer-events: none;
        ">
          Enemy Attacking!
        </div>
      \`);
      
      // Remove notice after 2 seconds
      enemy.userData.noticeTimer = (enemy.userData.noticeTimer || 0) + delta;
      if (enemy.userData.noticeTimer > 2) {
        removeHTML('attackNotice');
        enemy.userData.noticeTimer = 0;
      }
    } else {
      // Chase when far
      playAnimation('enemy.glb', 'run');
      
      // Remove notice if it exists
      removeHTML('attackNotice');
      enemy.userData.noticeTimer = 0;
    }
    
    // Make enemy face the player
    enemy.lookAt(player.position);
  }
}

return { update };`;

// Input management
const useInput = () => {
  const [input] = useState({
    keys: {},
    mouse: { x: 0, y: 0, buttons: {} }
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      input.keys[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e) => {
      input.keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e) => {
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
    };

    const handleMouseDown = (e) => {
      input.mouse.buttons[e.button] = true;
    };

    const handleMouseUp = (e) => {
      input.mouse.buttons[e.button] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [input]);

  return input;
};

// Scene component to handle animations and model rendering
const Scene = ({ activeModel, mixer, isCameraLocked, transformMode, isEditMode, modelScripts, sceneScript, uploadedModels, modelNames, onPlayAnimation, onStopAnimation }) => {
  const transformRef = useRef();
  const orbitRef = useRef();
  const input = useInput();
  const overlayRef = useRef(null);
  
  // Add refs for script caching
  const sceneScriptRef = useRef({ script: '', module: null });
  const modelScriptsRef = useRef([]);

  // Create overlay div for HTML elements if it doesn't exist
  useEffect(() => {
    if (!document.getElementById('scriptOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'scriptOverlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '1000';
      document.body.appendChild(overlay);
      overlayRef.current = overlay;
    }
    return () => {
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
      }
    };
  }, []);

  // Effect to handle script changes
  useEffect(() => {
    // Clear overlay when scripts change or mode changes
    if (overlayRef.current) {
      overlayRef.current.innerHTML = '';
    }
    
    // Reset scene script cache if changed
    if (sceneScript !== sceneScriptRef.current.script) {
      sceneScriptRef.current = { script: sceneScript, module: null };
    }
    
    // Reset model script caches if changed
    modelScripts.forEach((script, index) => {
      if (!modelScriptsRef.current[index] || modelScriptsRef.current[index].script !== script) {
        modelScriptsRef.current[index] = { script, module: null };
      }
    });
  }, [sceneScript, modelScripts, isEditMode]);

  const getModelByName = (name) => {
    const index = modelNames.indexOf(name);
    return index !== -1 ? uploadedModels[index] : null;
  };

  const getAnimationsForModel = (modelName) => {
    const model = getModelByName(modelName);
    return model?.animations || [];
  };

  const playAnimation = (modelName, animationName) => {
    if (!mixer) return;
    
    // Find the model by name or use the active model if modelName matches
    let targetModel = null;
    if (activeModel && modelName === activeModel.name) {
      targetModel = activeModel;
    } else {
      targetModel = getModelByName(modelName);
    }

    if (!targetModel) {
      console.log("No model found for", modelName);
      return;
    }

    // Get animations either from model or active model
    const modelAnimations = targetModel.animations || animations;
    if (!modelAnimations || modelAnimations.length === 0) {
      console.log("No animations found for", modelName);
      return;
    }

    const animation = modelAnimations.find(anim => anim.name === animationName);
    if (!animation) {
      console.log("Animation not found:", animationName, "for model", modelName);
      return;
    }

    console.log("Playing animation:", animationName, "for model", modelName);
    mixer.stopAllAction();
    const action = mixer.clipAction(animation, targetModel);
    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.clampWhenFinished = true;
    action.play();

    // Call the callback to update parent state
    if (onPlayAnimation) {
      onPlayAnimation(modelName, animationName);
    }
  };

  const stopAnimation = (modelName) => {
    if (mixer) {
      mixer.stopAllAction();
    }

    // Call the callback to update parent state
    if (onStopAnimation) {
      onStopAnimation(modelName);
    }
  };

  const createHTML = (html) => {
    if (!overlayRef.current) return;
    
    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Get the first element (our actual content)
    const element = temp.firstElementChild;
    
    // Add it to the overlay
    if (element) {
      overlayRef.current.appendChild(element);
    }
  };

  const removeHTML = (id) => {
    const element = document.getElementById(id);
    if (element && overlayRef.current) {
      overlayRef.current.removeChild(element);
    }
  };

  useFrame((state, delta) => {
    // Update mixer regardless of mode
    if (mixer) {
      mixer.update(delta);
    }

    // Only execute scripts in play mode
    if (!isEditMode) {
      // Execute scene script
      try {
        if (sceneScript) {
          // Use cached module if available
          if (!sceneScriptRef.current.module) {
            const scriptFn = new Function(
              'scene',
              'THREE',
              'getModelByName',
              'getAnimationsForModel',
              'playAnimation',
              'stopAnimation',
              'createHTML',
              'removeHTML',
              'input',
              'delta',
              'camera',
              `
              try {
                ${sceneScript}
              } catch (error) {
                console.error('Error in scene script:', error);
                return { update: () => {} };
              }
              `
            );

            try {
              sceneScriptRef.current.module = scriptFn.call(
                null,
                state.scene,
                THREE,
                (name) => {
                  const model = getModelByName(name);
                  return model;
                },
                getAnimationsForModel,
                (modelName, animName) => playAnimation(modelName, animName),
                stopAnimation,
                createHTML,
                removeHTML,
                input,
                delta,
                state.camera
              );
            } catch (error) {
              console.error('Error initializing scene script:', error);
              sceneScriptRef.current.module = { update: () => {} };
            }
          }

          // Execute cached module
          if (typeof sceneScriptRef.current.module === 'object' && typeof sceneScriptRef.current.module.update === 'function') {
            try {
              sceneScriptRef.current.module.update.call(
                null,
                state.scene,
                THREE,
                (name) => {
                  const model = getModelByName(name);
                  return model;
                },
                getAnimationsForModel,
                (modelName, animName) => playAnimation(modelName, animName),
                stopAnimation,
                createHTML,
                removeHTML,
                input,
                delta,
                state.camera
              );
            } catch (error) {
              console.error('Error executing scene script update:', error);
            }
          }
        }

        // Execute model scripts
        uploadedModels.forEach((model, index) => {
          const script = modelScripts[index];
          if (script) {
            try {
              // Use cached module if available
              if (!modelScriptsRef.current[index]?.module) {
                const scriptFn = new Function(
                  'model',
                  'scene',
                  'THREE',
                  'getModelByName',
                  'getAnimationsForModel',
                  'playAnimation',
                  'stopAnimation',
                  'createHTML',
                  'removeHTML',
                  'input',
                  'delta',
                  'camera',
                  `
                  try {
                    ${script}
                  } catch (error) {
                    console.error('Error in model script:', error);
                    return { update: () => {} };
                  }
                  `
                );

                if (!modelScriptsRef.current[index]) {
                  modelScriptsRef.current[index] = { script, module: null };
                }

                try {
                  modelScriptsRef.current[index].module = scriptFn.call(
                    null,
                    model,
                    state.scene,
                    THREE,
                    (name) => {
                      const model = getModelByName(name);
                      return model;
                    },
                    getAnimationsForModel,
                    (modelName, animName) => playAnimation(modelName, animName),
                    stopAnimation,
                    createHTML,
                    removeHTML,
                    input,
                    delta,
                    state.camera
                  );
                } catch (error) {
                  console.error(`Error initializing model script ${index}:`, error);
                  modelScriptsRef.current[index].module = { update: () => {} };
                }
              }

              // Execute cached module
              const cachedModule = modelScriptsRef.current[index]?.module;
              if (typeof cachedModule === 'object' && typeof cachedModule.update === 'function') {
                try {
                  cachedModule.update.call(
                    null,
                    model,
                    state.scene,
                    THREE,
                    (name) => {
                      const model = getModelByName(name);
                      return model;
                    },
                    getAnimationsForModel,
                    (modelName, animName) => playAnimation(modelName, animName),
                    stopAnimation,
                    createHTML,
                    removeHTML,
                    input,
                    delta,
                    state.camera
                  );
                } catch (error) {
                  console.error(`Error executing model script ${index} update:`, error);
                }
              }
            } catch (error) {
              console.error(`Error in model script ${index}:`, error);
            }
          }
        });
      } catch (error) {
        console.error('Error in script execution:', error);
      }
    }

    // Disable OrbitControls while using TransformControls
    if (transformRef.current) {
      const controls = transformRef.current;
      const callback = (event) => {
        orbitRef.current.enabled = !event.value;
      };
      
      controls.addEventListener('dragging-changed', callback);
      return () => controls.removeEventListener('dragging-changed', callback);
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      {/* Only show grid in edit mode */}
      {isEditMode && (
        <Grid 
          args={[10, 10]} 
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          cellSize={1} 
          sectionSize={1} 
          infiniteGrid 
        />
      )}
      <OrbitControls 
        ref={orbitRef}
        enablePan={!isCameraLocked}
        enableZoom={!isCameraLocked}
        enableRotate={!isCameraLocked}
        dampingFactor={0.25} 
        rotateSpeed={0.5} 
        panSpeed={0.5} 
        zoomSpeed={0.5} 
        target={[0, 0, 0]}
      />
      {/* Render all models */}
      {uploadedModels.map((model, index) => (
        <primitive key={index} object={model} />
      ))}
      {/* Show transform controls only for active model */}
      {activeModel && isEditMode && (
        <TransformControls
          ref={transformRef}
          object={activeModel}
          mode={transformMode.toLowerCase()}
          size={1}
        />
      )}
    </>
  );
};

const AnimationCanvas = ({ activeModel, mixer, isCameraLocked, transformMode, isEditMode, modelScripts, sceneScript, uploadedModels, modelNames, onPlayAnimation, onStopAnimation }) => {
  return (
    <Canvas className="flex-1" style={{ background: '#282c34' }}>
      <Scene 
        activeModel={activeModel} 
        mixer={mixer} 
        isCameraLocked={isCameraLocked}
        transformMode={transformMode}
        isEditMode={isEditMode}
        modelScripts={modelScripts}
        sceneScript={sceneScript}
        uploadedModels={uploadedModels}
        modelNames={modelNames}
        onPlayAnimation={onPlayAnimation}
        onStopAnimation={onStopAnimation}
      />
    </Canvas>
  );
};

// Add conversation memory system
const ConversationMemory = () => {
  const STORAGE_KEY = 'scriptGeneratorConversations';
  const MAX_CONVERSATIONS = 50;
  
  // Initialize or load existing conversations
  const loadConversations = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  };
  
  // Save conversations to localStorage
  const saveConversations = (conversations) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  };
  
  // Add a new conversation entry
  const addConversation = (prompt, script, selectedScriptType) => {
    const conversations = loadConversations();
    
    // Create new conversation entry
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      prompt,
      script,
      scriptType: selectedScriptType === 'scene' ? 'scene' : 'model',
      modelName: selectedScriptType !== 'scene' ? modelNames[selectedScriptType] : null,
      tokens: script.length / 4, // Rough estimate of token count
    };
    
    // Add to beginning of array and limit size
    conversations.unshift(newEntry);
    if (conversations.length > MAX_CONVERSATIONS) {
      conversations.pop();
    }
    
    saveConversations(conversations);
    return newEntry;
  };
  
  // Simple semantic search using term frequency
  const searchConversations = (query, maxResults = 3) => {
    if (!query || query.trim() === '') return [];
    
    const conversations = loadConversations();
    if (conversations.length === 0) return [];
    
    // Tokenize query into terms
    const queryTerms = query.toLowerCase().split(/\W+/).filter(term => term.length > 2);
    if (queryTerms.length === 0) return [];
    
    // Score each conversation
    const scoredConversations = conversations.map(conversation => {
      const text = `${conversation.prompt} ${conversation.scriptType} ${conversation.modelName || ''}`.toLowerCase();
      let score = 0;
      
      // Count term occurrences
      queryTerms.forEach(term => {
        const regex = new RegExp(term, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
        }
      });
      
      return { ...conversation, score };
    });
    
    // Sort by score and return top results
    return scoredConversations
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  };
  
  // Get all conversations
  const getAllConversations = () => {
    return loadConversations();
  };
  
  // Clear all conversations
  const clearConversations = () => {
    saveConversations([]);
  };
  
  return {
    addConversation,
    searchConversations,
    getAllConversations,
    clearConversations
  };
};

// Initialize the conversation memory
const conversationMemory = ConversationMemory();

const Engine = () => {
  const controlsRef = useRef();
  const [uploadedModels, setUploadedModels] = useState([]);
  const [modelNames, setModelNames] = useState([]); // Store names for models
  const [activeModel, setActiveModel] = useState(null);
  const [activeModelIndex, setActiveModelIndex] = useState(null); // Track active model index
  const [transformMode, setTransformMode] = useState('translate');
  const [isEditMode, setIsEditMode] = useState(true);
  const [isCameraLocked, setIsCameraLocked] = useState(false);
  const [activeMenu, setActiveMenu] = useState('main');
  const [animations, setAnimations] = useState([]);
  const [activeAnimation, setActiveAnimation] = useState(null);
  const [animationName, setAnimationName] = useState('');
  const [mixer, setMixer] = useState(null);
  const [editingModelName, setEditingModelName] = useState('');
  const [modelScripts, setModelScripts] = useState([]);
  const [sceneScript, setSceneScript] = useState(DEFAULT_SCENE_SCRIPT);
  const [selectedScript, setSelectedScript] = useState(null); // 'scene' or model index
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  // Add new state for script generation
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Add state for search query
  const [searchQuery, setSearchQuery] = useState('');

  // Add state for script examples
  const [scriptExamples, setScriptExamples] = useState({ modelScripts: [], sceneScripts: [] });
  const [examplesLoaded, setExamplesLoaded] = useState(false);

  // Load script examples on component mount
  useEffect(() => {
    const loadExamples = async () => {
      const examples = await loadScriptExamples();
      setScriptExamples(examples);
      setExamplesLoaded(true);
    };
    
    loadExamples();
  }, []);
  
  // Function to find relevant examples based on the prompt
  const findRelevantExamples = (prompt, scriptType, maxResults = 2) => {
    const examples = scriptType === 'scene' ? scriptExamples.sceneScripts : scriptExamples.modelScripts;
    
    // Simple keyword matching for relevance
    const keywords = prompt.toLowerCase().split(/\W+/).filter(word => word.length > 3);
    
    // Score each example
    const scoredExamples = examples.map(example => {
      const text = `${example.name} ${example.prompt}`.toLowerCase();
      let score = 0;
      
      keywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
        }
      });
      
      return { ...example, score };
    });
    
    // Sort by score and return top results
    return scoredExamples
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  };
  
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Shift') {
        setIsCameraLocked(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        loadModel(file.name, content);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const loadModel = (fileName, content) => {
    let loader;
    if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
      loader = new GLTFLoader();
      loader.parse(content, '', (object) => {
        resizeModel(object.scene || object);
        const model = object.scene || object;
        
        // Store animations on the model
        if (object.animations && object.animations.length > 0) {
          model.animations = object.animations;
        }
        
        setUploadedModels(prev => [...prev, model]);
        setModelNames(prev => [...prev, fileName]);
        setModelScripts(prev => [...prev, DEFAULT_MODEL_SCRIPT]); // Add default script
        setAnimations(object.animations || []);

        // Create mixer for the first model with animations
        if (!mixer && object.animations && object.animations.length > 0) {
          const newMixer = new THREE.AnimationMixer(model);
          setMixer(newMixer);
        }
      }, (error) => {
        console.error('Error loading GLTF model:', error);
      });
    } else if (fileName.endsWith('.obj')) {
      loader = new OBJLoader();
      loader.load(URL.createObjectURL(new Blob([content])), (object) => {
        resizeModel(object);
        setUploadedModels(prev => [...prev, object]);
        setModelNames(prev => [...prev, fileName]); // Add model name
      }, undefined, (error) => {
        console.error('Error loading OBJ model:', error);
      });
    } else if (fileName.endsWith('.fbx')) {
      loader = new FBXLoader();
      loader.load(URL.createObjectURL(new Blob([content])), (object) => {
        resizeModel(object);
        setUploadedModels(prev => [...prev, object]);
        setModelNames(prev => [...prev, fileName]); // Add model name
      }, undefined, (error) => {
        console.error('Error loading FBX model:', error);
      });
    } else {
      console.error('Unsupported file type');
      return;
    }
  };

  const resizeModel = (model) => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);

    if (maxSize > 1) {
      const scale = 1 / maxSize;
      model.scale.set(scale, scale, scale);
    }
    model.position.set(0, 0, 0);
  };

  const handleModelClick = (model, index) => {
    setActiveModel(model);
    setActiveModelIndex(index);
    setAnimations(model.animations || []);
    
    // Create new mixer if we don't have one and model has animations
    if (!mixer && model.animations && model.animations.length > 0) {
      const newMixer = new THREE.AnimationMixer(model);
      setMixer(newMixer);
    }
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  const handleAnimationSelect = (animation) => {
    setActiveAnimation(animation);
    setAnimationName(animation.name || ''); // Set the current name for editing
  };

  const handleAnimationRename = () => {
    if (activeAnimation) {
      activeAnimation.name = animationName; // Rename the animation
      setAnimations([...animations]); // Update the state to trigger re-render
    }
  };

  const stopAllAnimations = () => {
    if (mixer) {
      mixer.stopAllAction();
    }
  };

  const deleteModel = (index) => {
    const newModels = [...uploadedModels];
    const newNames = [...modelNames];
    newModels.splice(index, 1);
    newNames.splice(index, 1);
    setUploadedModels(newModels);
    setModelNames(newNames);
    if (activeModelIndex === index) {
      setActiveModel(null);
      setActiveModelIndex(null);
      setMixer(null);
      setAnimations([]);
    }
  };

  const duplicateModel = (index) => {
    const modelToClone = uploadedModels[index];
    const clonedModel = modelToClone.clone();
    const newName = `${modelNames[index]} (copy)`;
    setUploadedModels([...uploadedModels, clonedModel]);
    setModelNames([...modelNames, newName]);
  };

  const renameModel = (index, newName) => {
    const newNames = [...modelNames];
    newNames[index] = newName;
    setModelNames(newNames);
    setEditingModelName('');
  };

  const handleScriptChange = (value) => {
    if (selectedScript === 'scene') {
      setSceneScript(value);
    } else if (typeof selectedScript === 'number') {
      const newScripts = [...modelScripts];
      newScripts[selectedScript] = value;
      setModelScripts(newScripts);
    }
  };

  const handlePlayAnimation = (modelName, animationName) => {
    const model = activeModel;
    if (!model || !model.animations) {
      console.log("No model or animations found");
      return;
    }

    const animation = model.animations.find(anim => anim.name === animationName);
    if (!animation) {
      console.log("Animation not found:", animationName);
      return;
    }

    // Create mixer if it doesn't exist
    if (!mixer) {
      console.log("Creating new mixer");
      const newMixer = new THREE.AnimationMixer(model);
      setMixer(newMixer);
      return; // Return and let the next frame handle playing the animation
    }

    // Play the animation
    console.log("Playing animation:", animationName);
    mixer.stopAllAction();
    const action = mixer.clipAction(animation, model);
    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.clampWhenFinished = true;
    action.play();
  };

  const handleStopAnimation = () => {
    if (mixer) {
      mixer.stopAllAction();
    }
  };

  // Add edit button overlay
  useEffect(() => {
    if (!isEditMode) {
      const editButton = document.createElement('div');
      editButton.innerHTML = `
        <div style="
          position: absolute;
          top: 20px;
          right: 20px;
          cursor: pointer;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.5);
          padding: 10px;
          border-radius: 5px;
          transition: all 0.3s ease;
        "
        onmouseover="this.style.background='rgba(0, 0, 0, 0.8)'"
        onmouseout="this.style.background='rgba(0, 0, 0, 0.5)'"
        onclick="this.dispatchEvent(new CustomEvent('editMode', {bubbles: true}))"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </div>
      `;
      document.body.appendChild(editButton);

      const handleEditMode = () => {
        toggleEditMode();
      };

      document.addEventListener('editMode', handleEditMode);

      return () => {
        document.removeEventListener('editMode', handleEditMode);
        if (editButton.parentNode) {
          editButton.parentNode.removeChild(editButton);
        }
      };
    }
  }, [isEditMode]);

  // Add chat message handler
  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      setChatMessages([...chatMessages, chatMessage]);
      setChatMessage('');
    }
  };

  // Add chat keypress handler
  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Function to get scene state as JSON
  const getSceneState = () => {
    const sceneState = {
      models: uploadedModels.map((model, index) => ({
        name: modelNames[index],
        position: {
          x: model.position.x,
          y: model.position.y,
          z: model.position.z
        },
        rotation: {
          x: model.rotation.x,
          y: model.rotation.y,
          z: model.rotation.z
        },
        scale: {
          x: model.scale.x,
          y: model.scale.y,
          z: model.scale.z
        },
        animations: model.animations?.map(anim => ({
          name: anim.name,
          duration: anim.duration
        })) || []
      }))
    };
    return JSON.stringify(sceneState, null, 2);
  };

  // Update the generateScript function to use examples as context
  const generateScript = async (prompt) => {
    setIsGeneratingScript(true);
    try {
      // Get detailed scene state
      const sceneState = getSceneState();
      
        // Get the entire engine component code for context
        const engineCode = `
            // Current Engine.jsx implementation
            ${document.querySelector('script[src*="engine.jsx"]')?.textContent || ''}
        `;

        const messages = [
            { 
                role: "system", 
                content: `You are a script generator for a Three.js game engine. Generate ONLY pure JavaScript game scripts that follow this exact format and rules:

For MODEL scripts:
function update(model, scene, THREE, getModelByName, getAnimationsForModel, playAnimation, stopAnimation, createHTML, removeHTML, input, delta, camera) {
    // Initialize if needed
    if (!model.userData.initialized) {
        model.userData.initialized = true;
        model.userData.currentAnimation = 'idle';
        model.userData.baseSpeed = 5; // Base movement speed
        // Add other initial properties here
    }

    // Your game logic here
}

return { update };

For SCENE scripts:
function update(scene, THREE, getModelByName, getAnimationsForModel, playAnimation, stopAnimation, createHTML, removeHTML, input, delta, camera) {
    // Initialize if needed
    if (!scene.userData.initialized) {
        scene.userData.initialized = true;
        // Add initial scene properties here
    }

    // Your game logic here
}

return { update };

MOVEMENT RULES:
1. Always create a velocity vector: const velocity = new THREE.Vector3();
2. Add input to velocity: if (input.keys['w']) velocity.z -= 1;
3. Normalize velocity BEFORE applying speed: velocity.normalize();
4. Apply speed and delta time AFTER normalizing: velocity.multiplyScalar(speed * delta);
5. Finally add to position: model.position.add(velocity);
6. Use model.userData.baseSpeed (typically 5) for consistent movement
7. For sprinting, multiply baseSpeed by a sprint multiplier (typically 2)

ANIMATION RULES:
1. Store current animation in model.userData.currentAnimation
2. Check current animation before playing new one to prevent replaying
3. Use playAnimation(model.name, 'animationName') to play animations
4. Use stopAnimation(model.name) to stop all animations
5. Common animation names: 'idle', 'walk', 'run', 'jump', 'attack'
6. Update currentAnimation whenever changing animations
7. Handle animation transitions based on state changes

INPUT SYSTEM:
- input.keys['w'], input.keys['a'], input.keys['s'], input.keys['d'] - Movement
- input.keys['shift'] - Sprint/modifier
- input.keys['space'] - Jump/action
- input.mouse.x, input.mouse.y - Mouse position
- input.mouse.buttons[0] - Left click
- input.mouse.buttons[1] - Middle click
- input.mouse.buttons[2] - Right click

BEST PRACTICES:
- Always use delta time for movement
- Store persistent variables in userData
- Normalize vectors for consistent movement
- Use try-catch for error handling
- Clean up HTML elements when removed
- Add comments for clarity
- Keep code optimized and readable

DO NOT:
- Don't use keyDownMap or other input methods
- Don't modify camera directly from model scripts
- Don't access animations through getModelByName
- Don't forget to normalize vectors
- Don't skip delta time in movements
- Don't use React/JSX code

The script will be executed every frame in the useFrame hook of @react-three/fiber.`
            },
        { 
          role: "user", 
                content: `
CURRENT SCENE STATE:
${sceneState}

SCRIPT TYPE: ${selectedScript === 'scene' ? 'SCENE SCRIPT' : 'MODEL SCRIPT'}
${selectedScript !== 'scene' ? `MODEL NAME: ${modelNames[selectedScript]}` : ''}

AVAILABLE MODELS:
${modelNames.map(name => `- ${name}`).join('\n')}

GENERATE A ${selectedScript === 'scene' ? 'SCENE' : 'MODEL'} SCRIPT THAT:
${prompt}
`
        }
      ];

      const stream = await openai.chat.completions.create({
        model: "mistralai/Mistral-7B-Instruct-v0.3",
        messages,
        temperature: 0.2,
        max_tokens: 150000,
        stream: true,
            seed: 0
      });

      let generatedScript = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        generatedScript += content;
        
        if (selectedScript === 'scene') {
          setSceneScript(generatedScript);
        } else if (typeof selectedScript === 'number') {
          const newScripts = [...modelScripts];
          newScripts[selectedScript] = generatedScript;
          setModelScripts(newScripts);
        }
      }
      
      conversationMemory.addConversation(
        prompt, 
        generatedScript, 
        selectedScript
      );
      
    } catch (error) {
      console.error('Error generating script:', error);
    } finally {
      setIsGeneratingScript(false);
    }
  };
  
  // Add a function to export examples for fine-tuning
  const exportExamplesForFineTuning = () => {
    // Combine all examples
    const allExamples = [
      ...scriptExamples.modelScripts.map(ex => ({
        ...ex,
        scriptType: 'model'
      })),
      ...scriptExamples.sceneScripts.map(ex => ({
        ...ex,
        scriptType: 'scene'
      }))
    ];
    
    // Format examples for fine-tuning
    const formattedExamples = allExamples.map(example => {
      return {
        messages: [
          {
            role: "system",
            content: AI_PERSONALITY
          },
          {
            role: "user",
            content: `Generate a ${example.scriptType} script that: ${example.prompt}`
          },
          {
            role: "assistant",
            content: example.script
          }
        ]
      };
    });
    
    // Convert to JSONL format
    const jsonl = formattedExamples.map(ex => JSON.stringify(ex)).join('\n');
    
    // Create download link
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script_examples_for_finetuning.jsonl';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Handle selecting a conversation from history
  const handleSelectConversation = (conversation) => {
    // Set the selected script type
    if (conversation.scriptType === 'scene') {
      setSelectedScript('scene');
      setSceneScript(conversation.script);
    } else {
      // Find the model index by name
      const modelIndex = modelNames.findIndex(name => name === conversation.modelName);
      if (modelIndex !== -1) {
        setSelectedScript(modelIndex);
        const newScripts = [...modelScripts];
        newScripts[modelIndex] = conversation.script;
        setModelScripts(newScripts);
      }
    }
    
    // Set the prompt
    if (document.getElementById('scriptPrompt')) {
      document.getElementById('scriptPrompt').value = conversation.prompt;
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar Menu - Only show in edit mode */}
      <div className={`${isEditMode ? 'w-[500px] min-w-[500px] flex' : 'w-0 overflow-hidden'} transition-all duration-300 ease-in-out bg-gray-800 text-white flex-col justify-between shadow-lg`}>
        {/* Sidebar Menu Buttons */}
        <div className="flex flex-col space-y-2 mb-4 p-4">
          <button onClick={() => setActiveMenu('main')} className={`p-2 ${activeMenu === 'main' ? 'bg-gray-700' : ''}`}>Main Menu</button>
          <button onClick={() => setActiveMenu('models')} className={`p-2 ${activeMenu === 'models' ? 'bg-gray-700' : ''}`}>Models Menu</button>
          <button onClick={() => setActiveMenu('scene')} className={`p-2 ${activeMenu === 'scene' ? 'bg-gray-700' : ''}`}>Scene Menu</button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeMenu === 'models' && (
            <>
              <div>
                <h3 className="text-lg font-bold mb-2">Upload Model:</h3>
                <input type="file" accept=".glb,.gltf,.obj,.fbx" onChange={handleFileUpload} className="w-full bg-gray-700 text-white border-none rounded-lg p-2" />
              </div>
              <div className="mt-4">
                <label className="block mb-2">Transform Mode:</label>
                <select value={transformMode} onChange={(e) => setTransformMode(e.target.value)} className="w-full bg-gray-700 text-white border-none rounded-lg p-2">
                  <option value="translate">Translate</option>
                  <option value="rotate">Rotate</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-bold mb-2">Scripts:</h3>
                <button
                  onClick={() => setSelectedScript('scene')}
                  className={`w-full p-2 mb-2 ${selectedScript === 'scene' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  Scene Script
                </button>
                {uploadedModels.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedScript(index)}
                    className={`w-full p-2 mb-2 ${selectedScript === index ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    {modelNames[index]} Script
                  </button>
                ))}
                {selectedScript !== null && (
                  <div className="mt-4">
                    <div className="bg-gray-900 rounded-lg p-2">
                      <CodeMirror
                        value={selectedScript === 'scene' ? sceneScript : modelScripts[selectedScript]}
                        height="400px"
                        theme="dark"
                        extensions={[javascript()]}
                        onChange={handleScriptChange}
                      />
                    </div>

                    {/* Script Generation Controls */}
                    <div className="mt-4 bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-bold mb-2">AI Script Generation</h3>
                      
                      {/* Add search for similar scripts */}
                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Search previous scripts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg mb-2"
                        />
                        {searchQuery.trim() !== '' && (
                          <div className="max-h-40 overflow-y-auto bg-gray-900 rounded-lg p-2">
                            {conversationMemory.searchConversations(searchQuery, 5).map(result => (
                              <div 
                                key={result.id}
                                className="p-2 cursor-pointer hover:bg-gray-800 border-b border-gray-700"
                                onClick={() => handleSelectConversation(result)}
                              >
                                <div className="font-bold">{result.prompt.substring(0, 50)}{result.prompt.length > 50 ? '...' : ''}</div>
                                <div className="text-xs text-gray-400 flex justify-between">
                                  <span>{result.scriptType}{result.modelName ? `: ${result.modelName}` : ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <textarea
                        className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg mb-2"
                        placeholder="Describe what you want the script to do..."
                        rows={3}
                        id="scriptPrompt"
                      ></textarea>
                      <button
                        onClick={() => {
                          const prompt = document.getElementById('scriptPrompt').value;
                          generateScript(prompt);
                        }}
                        disabled={isGeneratingScript}
                        className={`w-full ${isGeneratingScript ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200`}
                      >
                        {isGeneratingScript ? 'Generating Script...' : 'Generate Script'}
                      </button>
                    </div>

                    {/* Add conversation history component */}
                    <ConversationHistory onSelectConversation={handleSelectConversation} />
                  </div>
                )}
              </div>
            </>
          )}
          {activeMenu === 'main' && (
            <div>
              <h3 className="text-lg font-bold mb-2">Main Settings:</h3>
              {/* Add any main settings options here */}
            </div>
          )}
          {activeMenu === 'scene' && (
            <div>
              <h3 className="text-lg font-bold mb-2">Scene Hierarchy:</h3>
              <ul className="list-disc pl-5">
                {uploadedModels.map((model, index) => (
                  <li key={index} className="mb-4">
                    <div className="flex items-center justify-between">
                      {editingModelName === index ? (
                        <input
                          type="text"
                          value={modelNames[index]}
                          onChange={(e) => {
                            const newNames = [...modelNames];
                            newNames[index] = e.target.value;
                            setModelNames(newNames);
                          }}
                          onBlur={() => setEditingModelName('')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingModelName('');
                            }
                          }}
                          className="bg-gray-700 text-white px-2 py-1 rounded"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className={`cursor-pointer ${activeModelIndex === index ? 'text-blue-400' : ''}`}
                          onClick={() => handleModelClick(model, index)}
                        >
                          {modelNames[index]}
                        </span>
                      )}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingModelName(index)}
                          className="px-2 py-1 bg-blue-500 rounded hover:bg-blue-600"
                          title="Rename"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => duplicateModel(index)}
                          className="px-2 py-1 bg-green-500 rounded hover:bg-green-600"
                          title="Duplicate"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => deleteModel(index)}
                          className="px-2 py-1 bg-red-500 rounded hover:bg-red-600"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <h3 className="text-lg font-bold mb-2 mt-4">Animations:</h3>
              <div className="mb-4">
                <button
                  onClick={stopAllAnimations}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                >
                  Stop All Animations
                </button>
              </div>
              <ul className="list-disc pl-5">
                {animations.map((animation, index) => (
                  <li key={index} className="cursor-pointer" onClick={() => handleAnimationSelect(animation)}>
                    {animation.name || `Animation ${index + 1}`}
                  </li>
                ))}
              </ul>
              {activeAnimation && (
                <div className="mt-4">
                  <input 
                    type="text" 
                    value={animationName} 
                    onChange={(e) => setAnimationName(e.target.value)} 
                    className="w-full bg-gray-700 text-white border-none rounded-lg p-2" 
                  />
                  <button 
                    onClick={handleAnimationRename} 
                    className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Rename Animation
                  </button>
                  <button 
                    onClick={() => handlePlayAnimation(activeModel.name, activeAnimation.name)} 
                    className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Play Animation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button 
          onClick={toggleEditMode} 
          className="m-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {isEditMode ? 'Switch to Play Mode' : 'Switch to Edit Mode'}
        </button>
      </div>

      {/* Main Content - Full width in play mode */}
      <div className="flex-1 relative">
        <AnimationCanvas 
          activeModel={activeModel} 
          mixer={mixer}
          isCameraLocked={isCameraLocked}
          transformMode={transformMode}
          isEditMode={isEditMode}
          modelScripts={modelScripts}
          sceneScript={sceneScript}
          uploadedModels={uploadedModels}
          modelNames={modelNames}
          onPlayAnimation={handlePlayAnimation}
          onStopAnimation={handleStopAnimation}
        />
      </div>
    </div>
  );
};

// Add conversation history UI to the sidebar
const ConversationHistory = ({ onSelectConversation }) => {
  const [conversations, setConversations] = useState([]);
  
  useEffect(() => {
    setConversations(conversationMemory.getAllConversations());
  }, []);
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const truncateText = (text, maxLength = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">Conversation History</h3>
        <button 
          onClick={() => {
            conversationMemory.clearConversations();
            setConversations([]);
          }}
          className="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
        >
          Clear All
        </button>
      </div>
      
      {conversations.length === 0 ? (
        <p className="text-gray-400 italic">No conversation history yet</p>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          {conversations.map(conv => (
            <div 
              key={conv.id}
              className="p-2 mb-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
              onClick={() => onSelectConversation(conv)}
            >
              <div className="text-sm font-bold">{truncateText(conv.prompt)}</div>
              <div className="text-xs text-gray-400 flex justify-between">
                <span>{conv.scriptType}{conv.modelName ? `: ${conv.modelName}` : ''}</span>
                <span>{formatDate(conv.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Engine;

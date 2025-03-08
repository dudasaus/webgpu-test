import shader from "./shader.wsgl?raw";

// VSCode doesn't like gpu.
// @ts-ignore
const gpu = navigator.gpu;

async function main() {
  if (!gpu) {
    console.error("WebGPU not supported.");
    return;
  }
  const adapter = await gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
  const context: any = canvas.getContext("webgpu")!;

  context.configure({
    device: device,
    format: gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    alphaMode: "opaque",
  });

  let colorTexture = context.getCurrentTexture();
  let colorTextureView = colorTexture.createView();

  // The default background color.
  const colorAttachment = {
    view: colorTextureView,
    clearValue: { r: 1, g: 0, b: 0, a: 1 },
    loadOp: "clear",
    storeOp: "store",
  };

  const positionAttribDesc = {
    shaderLocation: 0, // @location(0)
    offset: 0,
    format: "float32x3",
  };

  const colorAttribDesc = {
    shaderLocation: 1, // @location(1)
    offset: 4 * 3, // Afer 3 floats (position)
    format: "float32x3",
  };

  const positionColorBufferLayoutDesc = {
    attributes: [positionAttribDesc, colorAttribDesc],
    arrayStride: 4 * 6, // 0xAAABBB, Where A is position and B is color.
    stepMode: "vertex",
  };

  const positionColors = new Float32Array([
    1.0,
    -1.0,
    0.0, // position
    1.0,
    0.0,
    0.0, // 🔴
    -1.0,
    -1.0,
    0.0,
    0.0,
    1.0,
    0.0, // 🟢
    0.0,
    1.0,
    0.0,
    0.0,
    0.0,
    1.0, // 🔵
  ]);

  let positionColorBuffer = createGPUBuffer(
    device,
    positionColors,
    GPUBufferUsage.VERTEX,
  );

  const shaderModule = device.createShaderModule({
    code: shader,
  });

  const pipelineLayoutDesc = { bindGroupLayouts: [] };
  const layout = device.createPipelineLayout(pipelineLayoutDesc);

  const colorState = {
    format: "bgra8unorm",
  };

  const pipelineDesc = {
    layout,
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [positionColorBufferLayoutDesc],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [colorState],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "cw",
      cullMode: "back",
    },
  };

  const pipeline = device.createRenderPipeline(pipelineDesc);

  const renderPassDescriptor = {
    colorAttachments: [colorAttachment],
  };
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, positionColorBuffer);
  passEncoder.draw(3, 1);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}

function createGPUBuffer(
  device: GPUDevice,
  buffer: TypedArray & ArrayLike<number>,
  usage: any,
) {
  const bufferDesc: GPUBufferDescriptor = {
    label: "Unknown",
    size: buffer.byteLength,
    usage: usage,
    mappedAtCreation: true,
  };
  let gpuBuffer = device.createBuffer(bufferDesc);
  if (buffer instanceof Float32Array) {
    const writeArrayNormal = new Float32Array(gpuBuffer.getMappedRange());
    writeArrayNormal.set(buffer);
  } else if (buffer instanceof Uint16Array) {
    const writeArrayNormal = new Uint16Array(gpuBuffer.getMappedRange());
    writeArrayNormal.set(buffer);
  } else if (buffer instanceof Uint8Array) {
    const writeArrayNormal = new Uint8Array(gpuBuffer.getMappedRange());
    writeArrayNormal.set(buffer);
  } else if (buffer instanceof Uint32Array) {
    const writeArrayNormal = new Uint32Array(gpuBuffer.getMappedRange());
    writeArrayNormal.set(buffer);
  } else {
    const writeArrayNormal = new Float32Array(gpuBuffer.getMappedRange());
    writeArrayNormal.set(buffer);
    console.error("Unhandled buffer format ", typeof gpuBuffer);
  }
  gpuBuffer.unmap();
  return gpuBuffer;
}

main();

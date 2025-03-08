import shader from "./shader.wsgl?raw";
import texture1 from "@assets/texture1.png";

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

  const colorTexture = context.getCurrentTexture();
  const colorTextureView = colorTexture.createView();

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

  const positionColorBuffer = createGPUBuffer(
    device,
    positionColors,
    GPUBufferUsage.VERTEX,
  );

  const response = await fetch(texture1.src);
  const blob = await response.blob();
  const imgBitmap = await createImageBitmap(blob);
  const textureDescriptor = {
    size: { width: imgBitmap.width, height: imgBitmap.height },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  };
  const texture = device.createTexture(textureDescriptor);

  device.queue.copyExternalImageToTexture(
    { source: imgBitmap },
    { texture },
    textureDescriptor.size,
  );
  // Texture sampler.
  const sampler = device.createSampler({
    addressModeU: "repeat",
    addressModeV: "repeat",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  // WSGL shader code.
  const shaderModule = device.createShaderModule({
    code: shader,
  });

  const positionBufferLayoutDesc = {
    attributes: [positionAttribDesc],
    arrayStride: 4 * 3, // sizeof(float) * 3
    stepMode: "vertex",
  };

  const texCoordsAttribDesc = {
    shaderLocation: 1, // @location(1)
    offset: 0,
    format: "float32x2",
  };

  const texCoordsBufferLayoutDesc = {
    attributes: [texCoordsAttribDesc],
    arrayStride: 4 * 2, // sizeof(float) * 2
    stepMode: "vertex",
  };

  // 4 bytes * 9 pos = 36 bytes.
  const positions = new Float32Array([
    1.0,
    -1.0,
    0.0,
    -1.0,
    -1.0,
    0.0,
    0.0,
    1.0,
    0.0,
  ]);

  let positionBuffer = createGPUBuffer(
    device,
    positions,
    GPUBufferUsage.VERTEX,
  );

  const texCoords = new Float32Array([
    1.0,
    1.0,
    // 🔴
    0.0,
    1.0,

    0.5,
    0.0,
  ]);

  let texCoordsBuffer = createGPUBuffer(
    device,
    texCoords,
    GPUBufferUsage.VERTEX,
  );

  const uniformData = new Float32Array([
    0.1,
    0.1,
    0.1,
  ]);

  let uniformBuffer = createGPUBuffer(
    device,
    uniformData,
    GPUBufferUsage.UNIFORM,
  );

  let uniformBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
    ],
  });

  const uniformBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
      {
        binding: 1,
        resource: texture.createView(),
      },
      {
        binding: 2,
        resource: sampler,
      },
    ],
  });

  const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
  const layout = device.createPipelineLayout(pipelineLayoutDesc);

  const colorState = {
    format: "bgra8unorm",
  };

  const pipelineDesc = {
    layout,
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [positionBufferLayoutDesc, texCoordsBufferLayoutDesc],
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
  // See https://toji.dev/webgpu-best-practices/img-textures for image destroyed errors.
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, uniformBindGroup);
  console.log(positionBuffer);
  console.log(texCoordsBuffer);
  passEncoder.setVertexBuffer(0, positionBuffer);
  passEncoder.setVertexBuffer(1, texCoordsBuffer);
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

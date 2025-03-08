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

  let colorAttachment = {
    view: colorTextureView,
    clearValue: { r: 1, g: 0, b: 0, a: 1 },
    loadOp: "clear",
    storeOp: "store",
  };

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
      buffers: [],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [colorState],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "ccw",
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
  passEncoder.draw(3);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}

main();

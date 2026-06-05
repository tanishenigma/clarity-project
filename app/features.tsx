import MagicBento from "@/components/MagicBento";
import { BlurFade } from "@/components/ui/blur-fade";

const Features = () => {
  return (
    <section
      id="features"
      className="relative z-10 py-28 px-4 grid items-center justify-center">
      <div className="max-w-6xl mx-auto">
        <BlurFade className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-bold">
            Everything to <span className="text-primary">excel</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
            Comprehensive tools built for the way you actually study.
          </p>
        </BlurFade>
        <BlurFade>
          <MagicBento
            textAutoHide={true}
            enableStars
            enableSpotlight={true}
            enableBorderGlow={false}
            enableTilt={false}
            enableMagnetism
            clickEffect
            spotlightRadius={160}
            particleCount={25}
            disableAnimations={false}
          />
        </BlurFade>
      </div>
    </section>
  );
};

export default Features;
